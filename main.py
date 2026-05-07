"""
InfiNET Broadband Scraper API
==============================
Flask microservice that wraps the Selenium scraper.
Node.js backend calls this to get plans for a given address.

Usage:
  pip install flask selenium webdriver-manager beautifulsoup4
  python scraper_api.py

Endpoints:
  POST /scrape-plans
    Body: { "address": "9 George Street, North Strathfield NSW 2137", "plan_type": "Residential" }
    Returns: { "success": true, "packages": [...], "cached": false }
"""

import json, os, re, time, hashlib, threading
from datetime import datetime, timedelta
from flask import Flask, request, jsonify

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup

try:
    from webdriver_manager.chrome import ChromeDriverManager
    USE_WDM = True
except ImportError:
    USE_WDM = False

app = Flask(__name__)

# ── In-memory cache: address+type → { packages, timestamp } ──
CACHE = {}
CACHE_TTL_MINUTES = 30  # Cache plans for 30 minutes
CACHE_LOCK = threading.Lock()

SITE = "https://www.infinetbroadband.com.au/"


# ═══════════════════════════════════════════════════════════
#  BROWSER BUILDER
# ═══════════════════════════════════════════════════════════
def build_driver():
    opt = Options()
    opt.add_argument("--headless=new")
    opt.add_argument("--disable-gpu")
    opt.add_argument("--no-sandbox")
    opt.add_argument("--disable-dev-shm-usage")
    opt.add_argument("--window-size=1440,900")
    opt.add_argument("--disable-blink-features=AutomationControlled")
    opt.add_experimental_option("excludeSwitches", ["enable-automation"])
    opt.add_experimental_option("useAutomationExtension", False)
    opt.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )

    if USE_WDM:
        drv = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()), options=opt
        )
    else:
        drv = webdriver.Chrome(options=opt)

    drv.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
    )
    return drv


def jclick(drv, el):
    drv.execute_script("arguments[0].click();", el)


def scroll(drv, el):
    drv.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    time.sleep(0.3)


# ═══════════════════════════════════════════════════════════
#  SCRAPER STEPS
# ═══════════════════════════════════════════════════════════
def step_open(drv):
    drv.get(SITE)
    time.sleep(4)


def step_address_and_search(drv, address):
    wait = WebDriverWait(drv, 20)

    INPUT_SELECTORS = [
        "input[placeholder*='address'  i]",
        "input[placeholder*='street'   i]",
        "input[placeholder*='suburb'   i]",
        "input[placeholder*='enter'    i]",
        "input[placeholder*='search'   i]",
        "input[placeholder*='postcode' i]",
        "input[id*='address'    i]",
        "input[name*='address'  i]",
        "input[class*='address' i]",
        "input[type='search']",
        "input[type='text']",
    ]

    box = None
    for sel in INPUT_SELECTORS:
        els = [e for e in drv.find_elements(By.CSS_SELECTOR, sel)
               if e.is_displayed() and e.is_enabled()]
        if els:
            box = els[0]
            break

    if box is None:
        raise RuntimeError("Address input not found on page")

    scroll(drv, box)
    box.click()
    time.sleep(0.3)
    box.send_keys(Keys.CONTROL + "a")
    box.send_keys(Keys.DELETE)
    box.clear()
    time.sleep(0.2)

    for ch in address:
        box.send_keys(ch)
        time.sleep(0.05)

    time.sleep(3)

    # Click autocomplete suggestion
    DROP_SELECTORS = [
        ".pac-item", ".pac-container .pac-item",
        ".react-autosuggest__suggestion",
        "[class*='suggestion' i]", "[class*='autocomplete' i] li",
        "[class*='dropdown' i] li", "ul[role='listbox'] li",
        "[role='option']", ".geosuggest__item",
        "[class*='result' i]", "[class*='option' i]", "ul li",
    ]

    clicked = False
    for sel in DROP_SELECTORS:
        try:
            items = [el for el in drv.find_elements(By.CSS_SELECTOR, sel)
                     if el.is_displayed() and el.text.strip()]
            if items:
                scroll(drv, items[0])
                try:
                    items[0].click()
                except Exception:
                    jclick(drv, items[0])
                time.sleep(2)
                clicked = True
                break
        except Exception:
            pass

    if not clicked:
        box.send_keys(Keys.DOWN)
        time.sleep(0.4)
        box.send_keys(Keys.RETURN)
        time.sleep(2)

    # Click Search button
    SEARCH_BTN_SELECTORS = [
        "button[type='submit']", "input[type='submit']",
        "button[class*='search' i]", "button[class*='Search']",
        "button[class*='btn' i]", ".search-btn", ".ibps-search-btn",
        "[class*='ibps'][class*='btn']", "[class*='ibps'][class*='search']",
        "button",
    ]

    found_btn = False
    for sel in SEARCH_BTN_SELECTORS:
        btns = [b for b in drv.find_elements(By.CSS_SELECTOR, sel)
                if b.is_displayed() and b.is_enabled()]
        if not btns:
            continue
        priority = [b for b in btns
                    if any(w in (b.text or b.get_attribute("value") or
                                 b.get_attribute("aria-label") or "").lower()
                           for w in ("search", "check", "find", "go", "submit", "look"))]
        btn = priority[0] if priority else btns[0]
        scroll(drv, btn)
        try:
            btn.click()
        except Exception:
            jclick(drv, btn)
        found_btn = True
        break

    if not found_btn:
        box.send_keys(Keys.RETURN)

    time.sleep(4)


def step_plan_type(drv, plan_type):
    wait = WebDriverWait(drv, 15)

    if plan_type.strip().lower() == "residential":
        btn_value = "1"
        btn_class = "ibsp-hb-r"
    else:
        btn_value = "2"
        btn_class = "ibsp-hb-b"

    try:
        wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, ".ibsp--homesearch-button-wrapper, .ibsp--homesearch-button")
        ))
    except TimeoutException:
        pass

    time.sleep(1)

    strategies = [
        lambda: drv.find_element(By.CSS_SELECTOR, f"button.{btn_class}"),
        lambda: drv.find_element(By.CSS_SELECTOR, f"button[name='planType'][value='{btn_value}']"),
        lambda: drv.find_element(By.XPATH,
            f"//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
            f"'abcdefghijklmnopqrstuvwxyz'),'{plan_type.strip().lower()}')]"),
    ]

    for strat in strategies:
        try:
            btn = strat()
            scroll(drv, btn)
            jclick(drv, btn)
            time.sleep(3)
            return
        except Exception:
            pass


def step_wait_packages(drv):
    PACK_SELECTORS = [
        ".ibps-plans-wrapper:not(.ibps-type-wrapper)",
        "[class*='ibps'][class*='plan']",
        "[class*='ibps'][class*='package']",
        "[class*='plan' i]", "[class*='package' i]",
        "[class*='product' i]", "[class*='pricing' i]",
    ]

    for sel in PACK_SELECTORS:
        try:
            WebDriverWait(drv, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, sel))
            )
            time.sleep(3)
            return
        except TimeoutException:
            pass

    time.sleep(4)


def step_scrape(drv, plan_type):
    html = drv.page_source
    soup = BeautifulSoup(html, "html.parser")

    cards = soup.find_all("div", class_="ibps-plans-slides-inner")
    if not cards:
        cards = soup.find_all("div", class_=lambda c: c and "ibsp-plans-div" in c)
    if not cards:
        cards = []
        for label in soup.find_all("label"):
            if label.get("for", "").startswith("ibsp-pkg-select"):
                inner = label.find("div", class_=lambda c: c and "ibps-plans" in (c if isinstance(c, str) else " ".join(c)))
                if inner:
                    cards.append(inner)

    all_parsed = []
    for card in cards:
        pkg = _parse_card(card, plan_type)
        if pkg:
            all_parsed.append(pkg)

    # Keep only actual broadband plans (have speed AND price)
    packages = [p for p in all_parsed if p.get("speed_down") and p.get("price_month")]
    return packages


def _parse_card(card, plan_type):
    raw = card.get_text(" ", strip=True)
    if len(raw) < 10:
        return None

    p = {
        "plan_type": plan_type,
        "name": "",
        "typical_speed": "",
        "regular_price": "",
        "sale_price": "",
        "price_month": "",
        "promo": "",
        "min_cost": "",
        "data": "",
        "contract": "",
        "speed_down": "",
        "speed_up": "",
        "technology": "",
        "features": "",
        "critical_info": "",
        "fact_sheet": "",
        "product_id": "",
    }

    # Section One - plan name + typical speed
    sec1 = card.find("div", class_="ibsp-plans-sec-one")
    if sec1:
        h3 = sec1.find("h3")
        if h3:
            p["name"] = h3.get_text(strip=True)
        note = sec1.find("p", class_="ibsp-note-title")
        if note:
            p["typical_speed"] = note.get_text(strip=True)

    # Section Two - features
    sec2 = card.find("div", class_="ibsp-plans-sec-two")
    if sec2:
        ul = sec2.find("ul", class_="ibsp-features")
        if ul:
            items = [li.get_text(strip=True) for li in ul.find_all("li") if li.get_text(strip=True)]
            p["features"] = " | ".join(items)
            for item in items:
                item_l = item.lower()
                if "unlimit" in item_l:
                    p["data"] = "Unlimited"
                elif re.search(r"\d+\s*(gb|tb)", item_l):
                    m = re.search(r"(\d+)\s*(gb|tb)", item_l)
                    if m:
                        p["data"] = m.group(1) + " " + m.group(2).upper()
                if "no contract" in item_l or "month to month" in item_l:
                    p["contract"] = "No contract / Month to Month"

    # Section Three - pricing
    sec3 = card.find("div", class_="ibsp-plans-sec-three")
    if sec3:
        promo = sec3.find("p", class_="ibsp-sale-cal-text")
        if promo:
            p["promo"] = promo.get_text(" ", strip=True)

        reg_div = sec3.find("div", class_="ibsp-regular-price")
        if reg_div:
            amt = reg_div.find("span", class_="woocommerce-Price-amount")
            if amt:
                p["regular_price"] = "$" + amt.get_text(strip=True).replace("$", "").strip()

        sale_div = sec3.find("div", class_="ibsp-sale-price")
        if sale_div:
            amt = sale_div.find("span", class_="woocommerce-Price-amount")
            if amt:
                p["sale_price"] = "$" + amt.get_text(strip=True).replace("$", "").strip()

        p["price_month"] = p["sale_price"] or p["regular_price"]

        min_p = sec3.find("p", class_="ibsp-short-price")
        if min_p:
            p["min_cost"] = min_p.get_text(" ", strip=True)

        crit = sec3.find("p", class_="ibsp-critical-info")
        if crit and crit.find("a"):
            p["critical_info"] = crit.find("a")["href"]

        fact = sec3.find("p", class_="ibsp-fact-sheet")
        if fact and fact.find("a"):
            p["fact_sheet"] = fact.find("a")["href"]

        radio = sec3.find("input", class_="ibsp-pkg-select")
        if radio:
            p["product_id"] = radio.get("value", "")

    # Parse speed from plan name
    if p["name"]:
        m = re.search(r"(\d+)\s*/\s*(\d+)\s*[Mm]bps", p["name"])
        if m:
            p["speed_down"] = m.group(1) + " Mbps"
            p["speed_up"] = m.group(2) + " Mbps"
        else:
            m = re.search(r"(\d[\d.]*)\s*[Gg]bps", p["name"])
            if m:
                p["speed_down"] = str(int(float(m.group(1)) * 1000)) + " Mbps"
            else:
                m = re.search(r"(\d+)\s*[Mm]bps", p["name"])
                if m:
                    p["speed_down"] = m.group(1) + " Mbps"

    # Technology detection
    for tech in ["FTTP", "FTTN", "FTTC", "FTTB", "HFC", "OptiComm", "Opticomm",
                 "5G", "4G", "LTE", "NBN", "Fibre", "Fiber", "ADSL",
                 "Cable", "Fixed Wireless", "Wireless"]:
        if re.search(rf"\b{re.escape(tech)}\b", raw, re.I):
            p["technology"] = tech
            break

    # Determine network type from plan name for filtering
    name_lower = p["name"].lower()
    if "opticomm" in name_lower or "opti" in name_lower:
        p["network"] = "Opticomm"
    elif "nbn" in name_lower or "nbntm" in name_lower.replace(" ", ""):
        p["network"] = "NBN"
    elif "hir" in name_lower or "hope island" in name_lower:
        p["network"] = "HIR"
    elif "fixed wireless" in name_lower:
        p["network"] = "Fixed Wireless"
    elif "sky muster" in name_lower or "satellite" in name_lower:
        p["network"] = "Satellite"
    else:
        p["network"] = "Unknown"

    return p


# ═══════════════════════════════════════════════════════════
#  MAIN SCRAPE FUNCTION
# ═══════════════════════════════════════════════════════════
def scrape_plans(address, plan_type="Residential"):
    """Run the full scrape flow. Returns list of package dicts."""
    drv = None
    try:
        drv = build_driver()
        step_open(drv)
        step_address_and_search(drv, address)
        step_plan_type(drv, plan_type)
        step_wait_packages(drv)
        packages = step_scrape(drv, plan_type)
        return packages
    finally:
        if drv:
            try:
                drv.quit()
            except Exception:
                pass


def get_cache_key(address, plan_type):
    raw = f"{address.strip().lower()}|{plan_type.strip().lower()}"
    return hashlib.md5(raw.encode()).hexdigest()


# ═══════════════════════════════════════════════════════════
#  FLASK ENDPOINTS
# ═══════════════════════════════════════════════════════════
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "infinet-scraper"})


@app.route("/scrape-plans", methods=["POST"])
def api_scrape_plans():
    """
    POST /scrape-plans
    Body: {
      "address": "9 George Street, North Strathfield NSW 2137",
      "plan_type": "Residential"   // or "Business"
    }
    Optional query param: ?network=NBN or ?network=Opticomm to filter
    """
    body = request.get_json(force=True, silent=True) or {}
    address = body.get("address", "").strip()
    plan_type = body.get("plan_type", "Residential").strip()
    network_filter = body.get("network", "").strip()  # NBN or Opticomm

    if not address:
        return jsonify({"success": False, "error": "Address is required"}), 400

    if plan_type not in ("Residential", "Business"):
        plan_type = "Residential"

    # Check cache
    cache_key = get_cache_key(address, plan_type)
    with CACHE_LOCK:
        cached = CACHE.get(cache_key)
        if cached and datetime.now() - cached["timestamp"] < timedelta(minutes=CACHE_TTL_MINUTES):
            packages = cached["packages"]
            # Apply network filter if requested
            if network_filter:
                nf = network_filter.lower()
                packages = [p for p in packages if p.get("network", "").lower() == nf]
            return jsonify({
                "success": True,
                "packages": packages,
                "total": len(packages),
                "cached": True,
                "address": address,
                "plan_type": plan_type,
                "network_filter": network_filter or "all",
            })

    # Scrape fresh
    try:
        print(f"🔍 Scraping plans for: {address} ({plan_type})")
        start = time.time()
        packages = scrape_plans(address, plan_type)
        elapsed = round(time.time() - start, 1)
        print(f"✅ Found {len(packages)} packages in {elapsed}s")

        # Save to cache
        with CACHE_LOCK:
            CACHE[cache_key] = {
                "packages": packages,
                "timestamp": datetime.now(),
            }

        # Apply network filter if requested
        if network_filter:
            nf = network_filter.lower()
            packages = [p for p in packages if p.get("network", "").lower() == nf]

        return jsonify({
            "success": True,
            "packages": packages,
            "total": len(packages),
            "cached": False,
            "scrape_time_seconds": elapsed,
            "address": address,
            "plan_type": plan_type,
            "network_filter": network_filter or "all",
        })

    except Exception as e:
        print(f"❌ Scrape failed: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "address": address,
            "plan_type": plan_type,
        }), 500


@app.route("/clear-cache", methods=["POST"])
def clear_cache():
    with CACHE_LOCK:
        CACHE.clear()
    return jsonify({"success": True, "message": "Cache cleared"})


if __name__ == "__main__":
    print("╔══════════════════════════════════════════════════╗")
    print("║   INFINET BROADBAND SCRAPER API                 ║")
    print("║   POST /scrape-plans                            ║")
    print("║   Running on http://localhost:5050               ║")
    print("╚══════════════════════════════════════════════════╝")
    app.run(host="0.0.0.0", port=5050, debug=False, threaded=True)