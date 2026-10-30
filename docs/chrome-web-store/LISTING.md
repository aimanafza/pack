# PACK on the Chrome Web Store

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) when submitting the extension. Assets are in this folder; the package comes from `sh pack-extension/build.sh`.

## Before you submit

1. Merge the extension branch so `https://textpack.co/privacy` is live. Google opens it during review.
2. Make a reviewer account in PACK (approved, with 8 to 10 wardrobe pieces) so the reviewer can sign in and see real results. Its email and password go in **Test instructions** below.
3. Check that `hey@textpack.co` receives mail. The privacy policy tells people to write there to delete their account.

## Package

- File: `pack-extension/dist/pack-extension-1.1.0.zip`
- Visibility: **Unlisted** (only people with the link can install it)
- Regions: all
- Price: free

## Store listing tab

**Name**
PACK: Shop with your wardrobe

**Summary** (132 characters max)
See how any item works with the clothes you already own, before you buy it.

**Description**
PACK is a personal stylist for the clothes you already own. The extension brings your PACK wardrobe with you while you shop.

When you land on a clothing product page, PACK spots the piece and opens beside it. With one click it checks the item against your wardrobe:

• Scores for versatility, style fit, gap fill, brand quality and cost per outfit
• An honest verdict on whether it earns a place in your closet
• How many outfits it makes with what you own
• Real looks built from your own wardrobe, so you see it with your clothes before you buy

Every check is saved to your shopping history in PACK, so you can spot your patterns and spend more mindfully.

The extension works with a PACK account. PACK is currently open to members off the waitlist at textpack.co.

**Category**
Shopping

**Language**
English

**Graphic assets**
- Store icon: `store-icon-128.png`
- Screenshots (1280×800): `screenshot-1-product.png`, `screenshot-2-analysis.png`, `screenshot-3-looks.png`
- Small promo tile (440×280): `promo-tile-440x280.png`

**Official URL / Homepage**
https://textpack.co

**Support**
hey@textpack.co

## Privacy practices tab

**Single purpose**
Helps PACK members decide whether to buy a clothing item by checking it against the wardrobe they've saved in PACK.

**Permission justifications**

- `storage`: Keeps the member's PACK sign-in on their device, and the product found on each open tab until the tab is closed.
- `sidePanel`: PACK's results open in Chrome's side panel next to the product page, so the shopper can compare without leaving the page.
- Host permission (`<all_urls>`, content script on all sites): Clothing is sold on thousands of independent shops, so the extension can't list them in advance. On each page, a script checks inside the browser whether the page is a product page, using the page's product data, title and buttons, and shows a small PACK button if it is. Nothing is sent anywhere by this check. Product details leave the browser only when the member presses Analyse this purchase or Generate looks.

**Remote code**
No, I am not using remote code. (All scripts are in the package; the panel only loads fonts from Google Fonts as stylesheets.)

**Data usage: what the extension collects**
Tick:
- Authentication information (the PACK sign-in token)
- Website content (the product's name, image, price and brand, when the member asks for a check)
- Web history (the product page's address, sent with that check)

Leave everything else unticked: no personally identifiable information, health, financial, personal communications, location, or user activity tracking is collected by the extension.

**Certifications** (tick all three)
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL**
https://textpack.co/privacy

## Test instructions (for the reviewer)

> PACK works with a member account. Sign in with:
> Email: (reviewer account email)
> Password: (reviewer account password)
>
> 1. Click the PACK icon in the toolbar, then Connect to PACK, and sign in on the page that opens. The tab closes and the panel shows you're connected.
> 2. Open a clothing product page, for example https://www.thereformation.com/products/marcia-silk-skirt/1318620ALO.html
> 3. A small dark PACK button appears at the bottom right of the page, and the panel shows the product. Press Analyse this purchase; results take about 20 seconds.
> 4. Press Generate looks to see outfits built from the account's wardrobe.

## After approval

1. Copy the store page link.
2. In Vercel, add `VITE_CHROME_STORE_URL` with that link and redeploy. The landing page's "Coming soon to Chrome" turns into "Add to Chrome, free".
3. Send the link to approved members.

## Releasing an update

1. Bump `version` in `pack-extension/manifest.json`.
2. Run `sh pack-extension/build.sh`.
3. Upload the new zip in the Dashboard under Package, then submit for review.
