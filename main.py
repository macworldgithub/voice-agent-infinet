"""
Infinet Broadband Scraper
=========================
Flow:
  1. Open site
  2. Type address → press Search button
  3. Click Residential (#ptr) or Business (#ptb) radio
  4. Scrape all packages

pip install selenium webdriver-manager beautifulsoup4 pandas openpyxl
"""

import json, os, re, time
import pandas as pd
from bs4 import BeautifulSoup

from selenium import webdriver
from selenium.webdriver.chrome.options  import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by      import By
from selenium.webdriver.common.keys    import Keys
from selenium.webdriver.support.ui     import WebDriverWait
from selenium.webdriver.support        import expected_conditions as EC
from selenium.common.exceptions        import TimeoutException
from webdriver_manager.chrome          import ChromeDriverManager

# ═══════════════════════════════════════════════════════════
#  ✏️  EDIT THESE 3 LINES ONLY
# ═══════════════════════════════════════════════════════════
ADDRESS   = "9 George Street, North Strathfield NSW 2137"
PLAN_TYPE = "Residential"   # "Residential"  or  "Business"
HEADLESS  = False           # False = watch browser  |  True = silent
# ═══════════════════════════════════════════════════════════

SITE = "https://www.infinetbroadband.com.au/"
os.makedirs("screenshots", exist_ok=True)


# ── tiny helpers ──────────────────────────────────────────
def log(m):   print(f"     {m}")
def ok(m):    print(f"  ✅  {m}")
def warn(m):  print(f"  ⚠️   {m}")
def fail(m):  print(f"  ❌  {m}")

def snap(drv, name):
    p = f"screenshots/{name}.png"
    drv.save_screenshot(p)
    log(f"📸 {p}")

def jclick(drv, el):
    """JavaScript click — bypasses any overlay."""
    drv.execute_script("arguments[0].click();", el)

def scroll(drv, el):
    drv.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
    time.sleep(0.3)


# ── browser ───────────────────────────────────────────────
def build_driver():
    opt = Options()
    if HEADLESS:
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
    drv = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()), options=opt
    )
    drv.execute_cdp_cmd(
        "Page.addScriptToEvaluateOnNewDocument",
        {"source": "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"},
    )
    return drv


# ═══════════════════════════════════════════════════════════
#  STEP 1 — open site
# ═══════════════════════════════════════════════════════════
def step1_open(drv):
    print("\n── STEP 1  Open site ─────────────────────────────────")
    drv.get(SITE)
    time.sleep(4)
    snap(drv, "01_homepage")
    ok(f"Loaded: {drv.title}")


# ═══════════════════════════════════════════════════════════
#  STEP 2 — type address  then  click Search
# ═══════════════════════════════════════════════════════════
def step2_address_and_search(drv):
    print(f"\n── STEP 2  Type address + Search ────────────────────")
    log(f"Address: {ADDRESS}")
    wait = WebDriverWait(drv, 20)

    # ── find the address input ──────────────────────────────
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
            ok(f"Input: {sel}  |  placeholder='{box.get_attribute('placeholder')}'")
            break

    if box is None:
        snap(drv, "ERR_no_input")
        raise RuntimeError("Address input not found — see screenshots/ERR_no_input.png")

    # ── clear and type slowly ───────────────────────────────
    scroll(drv, box)
    box.click(); time.sleep(0.3)
    box.send_keys(Keys.CONTROL + "a")
    box.send_keys(Keys.DELETE)
    box.clear();  time.sleep(0.2)

    for ch in ADDRESS:
        box.send_keys(ch)
        time.sleep(0.07)

    time.sleep(3)
    snap(drv, "02a_typed")
    ok("Address typed")

    # ── wait for autocomplete dropdown and click FIRST item ─
    DROP_SELECTORS = [
        ".pac-item",
        ".pac-container .pac-item",
        ".react-autosuggest__suggestion",
        "[class*='suggestion'   i]",
        "[class*='autocomplete' i] li",
        "[class*='dropdown'     i] li",
        "ul[role='listbox'] li",
        "[role='option']",
        ".geosuggest__item",
        "[class*='result'  i]",
        "[class*='option'  i]",
        "ul li",
    ]

    clicked_suggestion = False
    for sel in DROP_SELECTORS:
        try:
            items = [el for el in drv.find_elements(By.CSS_SELECTOR, sel)
                     if el.is_displayed() and el.text.strip()]
            if not items:
                continue
            ok(f"Dropdown via: {sel}  ({len(items)} items)")
            for i, it in enumerate(items[:5]):
                tag = "  ← clicking" if i == 0 else ""
                log(f"   [{i}] {it.text.strip()[:80]}{tag}")
            scroll(drv, items[0])
            try:
                items[0].click()
            except Exception:
                jclick(drv, items[0])
            time.sleep(2)
            snap(drv, "02b_suggestion_selected")
            ok("First suggestion selected")
            clicked_suggestion = True
            break
        except Exception:
            pass

    if not clicked_suggestion:
        warn("No dropdown found — pressing Down + Enter")
        box.send_keys(Keys.DOWN);   time.sleep(0.4)
        box.send_keys(Keys.RETURN); time.sleep(2)

    # ── now press the Search button ─────────────────────────
    SEARCH_BTN_SELECTORS = [
        "button[type='submit']",
        "input[type='submit']",
        "button[class*='search' i]",
        "button[class*='Search']",
        "button[id*='search'    i]",
        "button[class*='btn'    i]",
        ".search-btn",
        ".ibps-search-btn",
        "[class*='ibps'][class*='btn']",
        "[class*='ibps'][class*='search']",
        "button",
    ]

    found_btn = False
    for sel in SEARCH_BTN_SELECTORS:
        btns = [b for b in drv.find_elements(By.CSS_SELECTOR, sel)
                if b.is_displayed() and b.is_enabled()]
        if not btns:
            continue
        # prefer a button whose text/value/aria contains "search" or "check"
        priority = [b for b in btns
                    if any(w in (b.text or b.get_attribute("value") or
                                 b.get_attribute("aria-label") or "").lower()
                           for w in ("search","check","find","go","submit","look"))]
        btn = priority[0] if priority else btns[0]
        ok(f"Search button: {sel}  |  text='{btn.text.strip()}'")
        scroll(drv, btn)
        try:
            btn.click()
        except Exception:
            jclick(drv, btn)
        found_btn = True
        break

    if not found_btn:
        warn("Search button not found — pressing Enter in address box")
        box.send_keys(Keys.RETURN)

    time.sleep(4)
    snap(drv, "02c_after_search")
    ok("Search done")


# ═══════════════════════════════════════════════════════════
#  STEP 3 — select Residential or Business
#  HTML:
#    Residential → <input type="radio" id="ptr" name="planType" value="1">
#    Business    → <input type="radio" id="ptb" name="planType" value="2">
#  The <label> wrapping each radio gets class "active-radio-bg" when chosen
# ═══════════════════════════════════════════════════════════
def step3_plan_type(drv):
    print(f"\n── STEP 3  Select plan type: {PLAN_TYPE} ──────────────")
    wait = WebDriverWait(drv, 15)

    # ── Real HTML structure:
    #   Residential → <button class="ibsp--homesearch-button ibsp-hb-r" name="planType" value="1">
    #   Business    → <button class="ibsp--homesearch-button ibsp-hb-b" name="planType" value="2">

    if PLAN_TYPE.strip().lower() == "residential":
        btn_value     = "1"
        btn_class     = "ibsp-hb-r"          # unique class on the Residential button
    else:
        btn_value     = "2"
        btn_class     = "ibsp-hb-b"          # unique class on the Business button

    # wait for the wrapper to appear
    try:
        wait.until(EC.presence_of_element_located(
            (By.CSS_SELECTOR, ".ibsp--homesearch-button-wrapper, .ibsp--homesearch-button")
        ))
        ok("Plan-type buttons appeared")
    except TimeoutException:
        warn("Button wrapper not detected — trying anyway")

    time.sleep(1)

    # ── Strategy 1: by unique class  (most specific) ───────
    try:
        btn = drv.find_element(By.CSS_SELECTOR, f"button.{btn_class}")
        scroll(drv, btn)
        jclick(drv, btn)
        time.sleep(3)
        snap(drv, f"03_{PLAN_TYPE.lower()}_clicked")
        ok(f"Clicked button.{btn_class}  →  '{btn.text.strip()}'")
        return
    except Exception:
        pass

    # ── Strategy 2: by name + value ────────────────────────
    try:
        btn = drv.find_element(
            By.CSS_SELECTOR,
            f"button[name='planType'][value='{btn_value}']"
        )
        scroll(drv, btn)
        jclick(drv, btn)
        time.sleep(3)
        snap(drv, f"03_{PLAN_TYPE.lower()}_clicked")
        ok(f"Clicked button[name=planType][value={btn_value}]  →  '{btn.text.strip()}'")
        return
    except Exception:
        pass

    # ── Strategy 3: by button text (contains "Residential" / "Business") ──
    try:
        btn = drv.find_element(
            By.XPATH,
            f"//button[contains(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
            f"'abcdefghijklmnopqrstuvwxyz'),'{PLAN_TYPE.strip().lower()}')]"
        )
        scroll(drv, btn)
        jclick(drv, btn)
        time.sleep(3)
        snap(drv, f"03_{PLAN_TYPE.lower()}_clicked")
        ok(f"Clicked button by text  →  '{btn.text.strip()}'")
        return
    except Exception:
        pass

    # ── Strategy 4: by base class on all submit buttons ────
    try:
        btns = drv.find_elements(By.CSS_SELECTOR, "button.ibsp--homesearch-button")
        log(f"All ibsp--homesearch-button buttons ({len(btns)}):")
        for b in btns:
            log(f"   value={b.get_attribute('value')}  text='{b.text.strip()}'")
        target = [b for b in btns if b.get_attribute("value") == btn_value]
        if target:
            scroll(drv, target[0])
            jclick(drv, target[0])
            time.sleep(3)
            snap(drv, f"03_{PLAN_TYPE.lower()}_clicked")
            ok(f"Clicked via value match  →  '{target[0].text.strip()}'")
            return
    except Exception:
        pass

    snap(drv, "03_NOT_found")
    warn(f"Could not click '{PLAN_TYPE}' button — scraping whatever is visible")


# ═══════════════════════════════════════════════════════════
#  STEP 4 — wait for package cards to load
# ═══════════════════════════════════════════════════════════
def step4_wait(drv):
    print("\n── STEP 4  Wait for packages ────────────────────────")

    PACK_SELECTORS = [
        ".ibps-plans-wrapper:not(.ibps-type-wrapper)",
        "[class*='ibps'][class*='plan']",
        "[class*='ibps'][class*='package']",
        "[class*='plan'     i]",
        "[class*='package'  i]",
        "[class*='product'  i]",
        "[class*='pricing'  i]",
        "[class*='offer'    i]",
        "[class*='bundle'   i]",
        "[class*='nbn'      i]",
        "[class*='internet' i]",
    ]

    for sel in PACK_SELECTORS:
        try:
            WebDriverWait(drv, 20).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, sel))
            )
            ok(f"Packages appeared — '{sel}'")
            time.sleep(3)
            snap(drv, "04_packages_loaded")
            return
        except TimeoutException:
            pass

    warn("Package container not found in time — scraping now")
    time.sleep(4)
    snap(drv, "04_timeout")


# ═══════════════════════════════════════════════════════════
#  STEP 5 — scrape all package cards
# ═══════════════════════════════════════════════════════════
def step5_scrape(drv):
    print("\n── STEP 5  Scrape packages ──────────────────────────")

    html = drv.page_source
    with open("page_source.html", "w", encoding="utf-8") as f:
        f.write(html)
    log("Saved: page_source.html")

    soup = BeautifulSoup(html, "html.parser")

    # ── check for no-service messages ────────────────────────
    page_text = soup.get_text(" ").lower()
    for phrase in ["not available","no service","no plans","not covered",
                   "outside coverage","no nbn","address not found","no packages"]:
        if phrase in page_text:
            warn(f"Page says: '{phrase}'")

    # ── find all package cards ────────────────────────────────
    # Real HTML structure:
    #   <label for="ibsp-pkg-select-XXXX">
    #     <div class="ibps-plans-slides-inner ibsp-plans-div">
    #       <div class="ibps-plans-slides-inner-title">
    #         <div class="ibsp-plans-sec-one">   ← plan name + note
    #         <div class="ibsp-plans-sec-two">   ← features list
    #         <div class="ibsp-plans-sec-three"> ← prices + buttons

    cards = soup.find_all("div", class_="ibps-plans-slides-inner")

    if not cards:
        # try alternative class
        cards = soup.find_all("div", class_=lambda c: c and "ibsp-plans-div" in c)

    if not cards:
        # fallback — any label wrapping a package radio
        cards = []
        for label in soup.find_all("label"):
            if label.get("for","").startswith("ibsp-pkg-select"):
                inner = label.find("div", class_=lambda c: c and "ibps-plans" in (c if isinstance(c,str) else " ".join(c)))
                if inner:
                    cards.append(inner)

    log(f"Package cards found: {len(cards)}")

    all_parsed = []
    for i, card in enumerate(cards):
        pkg = _parse(card)
        if pkg:
            all_parsed.append(pkg)

    # ── keep ONLY actual broadband plans ─────────────────────────────────────
    # Real plans always have BOTH a download speed AND a monthly price.
    # Modems, VoIP plans, and static IP add-ons have neither → drop them.
    packages = [
        p for p in all_parsed
        if p.get("speed_down") and p.get("price_month")
    ]

    dropped = len(all_parsed) - len(packages)
    log(f"Total cards parsed       : {len(all_parsed)}")
    log(f"Dropped (modems/VoIP/etc): {dropped}")
    ok(f"Broadband plans kept     : {len(packages)}")
    print()
    for i, p in enumerate(packages):
        ok(f"  [{i+1}] {p['name']}  —  {p['price_month']}/month  |  "
           f"{p['speed_down']} down / {p['speed_up']} up")

    return packages


def _parse(card):
    """
    Parse one .ibps-plans-slides-inner card using the exact class names
    from the site's real HTML.
    """
    raw = card.get_text(" ", strip=True)
    if len(raw) < 10:
        return None

    p = {
        "plan_type"       : PLAN_TYPE,
        "name"            : "",
        "typical_speed"   : "",
        "regular_price"   : "",
        "sale_price"      : "",
        "price_month"     : "",
        "promo"           : "",
        "min_cost"        : "",
        "data"            : "",
        "contract"        : "",
        "speed_down"      : "",
        "speed_up"        : "",
        "technology"      : "",
        "features"        : "",
        "critical_info"   : "",
        "fact_sheet"      : "",
        "product_id"      : "",
    }

    # ── SECTION ONE — plan name + typical speed note ──────────
    sec1 = card.find("div", class_="ibsp-plans-sec-one")
    if sec1:
        h3 = sec1.find("h3")
        if h3:
            p["name"] = h3.get_text(strip=True)

        note = sec1.find("p", class_="ibsp-note-title")
        if note:
            p["typical_speed"] = note.get_text(strip=True)

    # ── SECTION TWO — feature bullets ─────────────────────────
    sec2 = card.find("div", class_="ibsp-plans-sec-two")
    if sec2:
        ul = sec2.find("ul", class_="ibsp-features")
        if ul:
            items = [li.get_text(strip=True) for li in ul.find_all("li") if li.get_text(strip=True)]
            p["features"] = "  |  ".join(items)

            # pull structured fields out of features
            for item in items:
                item_l = item.lower()
                if "unlimit" in item_l:
                    p["data"] = "Unlimited"
                elif re.search(r"\d+\s*(gb|tb)", item_l):
                    m = re.search(r"(\d+)\s*(gb|tb)", item_l)
                    if m: p["data"] = m.group(1) + " " + m.group(2).upper()
                if "no contract" in item_l or "month to month" in item_l:
                    p["contract"] = "No contract / Month to Month"

    # ── SECTION THREE — pricing ────────────────────────────────
    sec3 = card.find("div", class_="ibsp-plans-sec-three")
    if sec3:

        # promo banner  e.g. "SAVE $5.00 A MONTH FOR THE FIRST 3 MONTHS!"
        promo = sec3.find("p", class_="ibsp-sale-cal-text")
        if promo:
            p["promo"] = promo.get_text(" ", strip=True)

        # regular (was) price  →  inside .ibsp-regular-price  <del>
        reg_div = sec3.find("div", class_="ibsp-regular-price")
        if reg_div:
            amt = reg_div.find("span", class_="woocommerce-Price-amount")
            if amt:
                p["regular_price"] = "$" + amt.get_text(strip=True).replace("$","").strip()

        # sale / current price  →  inside .ibsp-sale-price
        sale_div = sec3.find("div", class_="ibsp-sale-price")
        if sale_div:
            amt = sale_div.find("span", class_="woocommerce-Price-amount")
            if amt:
                p["sale_price"] = "$" + amt.get_text(strip=True).replace("$","").strip()

        # price_month = sale price if exists, else regular price
        p["price_month"] = p["sale_price"] or p["regular_price"]

        # minimum cost  →  .ibsp-short-price
        min_p = sec3.find("p", class_="ibsp-short-price")
        if min_p:
            p["min_cost"] = min_p.get_text(" ", strip=True)

        # critical information link
        crit = sec3.find("p", class_="ibsp-critical-info")
        if crit and crit.find("a"):
            p["critical_info"] = crit.find("a")["href"]

        # fact sheet link
        fact = sec3.find("p", class_="ibsp-fact-sheet")
        if fact and fact.find("a"):
            p["fact_sheet"] = fact.find("a")["href"]

        # product id  →  from radio input value
        radio = sec3.find("input", class_="ibsp-pkg-select")
        if radio:
            p["product_id"] = radio.get("value","")

    # ── parse speed from plan name  e.g. "50/20Mbps" ──────────
    if p["name"]:
        m = re.search(r"(\d+)\s*/\s*(\d+)\s*[Mm]bps", p["name"])
        if m:
            p["speed_down"] = m.group(1) + " Mbps"
            p["speed_up"]   = m.group(2) + " Mbps"
        else:
            m = re.search(r"(\d[\d.]*)\s*[Gg]bps", p["name"])
            if m:
                p["speed_down"] = str(int(float(m.group(1)) * 1000)) + " Mbps"
            else:
                m = re.search(r"(\d+)\s*[Mm]bps", p["name"])
                if m: p["speed_down"] = m.group(1) + " Mbps"

    # ── technology from plan name or raw text ──────────────────
    for tech in ["FTTP","FTTN","FTTC","FTTB","HFC","OptiComm","Opticomm",
                 "5G","4G","LTE","NBN","Fibre","Fiber","ADSL",
                 "Cable","Fixed Wireless","Wireless"]:
        if re.search(rf"\b{re.escape(tech)}\b", raw, re.I):
            p["technology"] = tech; break

    return p


# ═══════════════════════════════════════════════════════════
#  STEP 6 — print + save
# ═══════════════════════════════════════════════════════════
def step6_save(packages):
    print("\n── STEP 6  Results ──────────────────────────────────")

    if not packages:
        print()
        fail("NO PACKAGES FOUND")
        log("Reasons: address not serviceable / wrong location / page changed")
        log("Open  screenshots/  and  page_source.html  to debug")
        return

    SEP = "─" * 60
    print(f"\n  {SEP}")
    print(f"  {PLAN_TYPE.upper()} PACKAGES  ·  {ADDRESS}")
    print(f"  {SEP}")

    FIELDS = [
        ("name",          "Plan Name"),
        ("plan_type",     "Type"),
        ("technology",    "Technology"),
        ("speed_down",    "Download"),
        ("speed_up",      "Upload"),
        ("typical_speed", "Typical Speed"),
        ("regular_price", "Regular Price"),
        ("sale_price",    "Sale Price"),
        ("price_month",   "Price / Month"),
        ("promo",         "Promotion"),
        ("min_cost",      "Min Cost"),
        ("data",          "Data"),
        ("contract",      "Contract"),
        ("features",      "Features"),
        ("critical_info", "Critical Info"),
        ("fact_sheet",    "Fact Sheet"),
        ("product_id",    "Product ID"),
    ]

    for i, pkg in enumerate(packages, 1):
        print(f"\n  📦  Package {i}")
        print(f"  {'·'*45}")
        for key, label in FIELDS:
            val = pkg.get(key,"")
            if not val: continue
            if key == "features":
                parts = [x.strip() for x in val.split("  |  ") if x.strip()]
                print(f"    {'Features':<16}:")
                for pt in parts:
                    print(f"       • {pt}")
            else:
                print(f"    {label:<16}:  {val}")

    print(f"\n  {SEP}")
    print(f"  Total: {len(packages)} packages")
    print(f"  {SEP}\n")

    # ── save files ────────────────────────────────────────
    clean = [{k: v for k, v in p.items() if k != "raw_text"} for p in packages]
    safe  = re.sub(r"[^\w]", "_", f"{PLAN_TYPE}_{ADDRESS}")[:55]
    base  = f"infinet_{safe}"

    with open(f"{base}.json","w",encoding="utf-8") as f:
        json.dump(clean, f, indent=2, ensure_ascii=False)
    pd.DataFrame(clean).to_csv(f"{base}.csv",    index=False)
    pd.DataFrame(clean).to_excel(f"{base}.xlsx", index=False)

    ok(f"Saved: {base}.json  /  .csv  /  .xlsx")


# ═══════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════
def main():
    print()
    print("╔══════════════════════════════════════════════════════╗")
    print("║       INFINET BROADBAND SCRAPER                     ║")
    print("╠══════════════════════════════════════════════════════╣")
    print(f"║  Address   :  {ADDRESS[:48]:<48} ║")
    print(f"║  Plan type :  {PLAN_TYPE:<48} ║")
    print(f"║  Headless  :  {str(HEADLESS):<48} ║")
    print("╚══════════════════════════════════════════════════════╝")

    drv = None
    try:
        drv = build_driver()
        step1_open(drv)
        step2_address_and_search(drv)
        step3_plan_type(drv)
        step4_wait(drv)
        packages = step5_scrape(drv)
        step6_save(packages)

    except Exception as e:
        print(f"\n  ❌  FATAL: {e}")
        if drv:
            snap(drv, "FATAL")
            with open("page_source_error.html","w",encoding="utf-8") as f:
                f.write(drv.page_source)
            log("Saved: screenshots/FATAL.png + page_source_error.html")
        raise

    finally:
        if drv:
            input("\n  Press ENTER to close browser …\n")
            drv.quit()


if __name__ == "__main__":
    main()