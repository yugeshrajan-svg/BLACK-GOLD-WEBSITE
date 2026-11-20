# Getting found on Google

Goal: when a service centre or factory in Chennai searches for someone to buy their used oil, Black Gold appears near the top.

## What the website already does

| Page | Searches it is written for |
| --- | --- |
| Home | used oil buyers in Chennai, waste oil buyers Chennai, sell used engine oil Chennai |
| What we collect | used engine oil buyers, hydraulic oil buyers, transformer oil buyers in Chennai, plus each area (Ambattur, Guindy, Sriperumbudur...) |
| For industry | waste cutting oil, coolant, oily sludge collection Chennai |
| Seller app | sell used oil from your phone |
| FAQs | used oil rates, minimum quantity, payment |

- Every page has its own search title and description. `npm run check` fails if one is missing, repeated or too long.
- The home page tells Google the business name, address, phone, payment, the areas served and everything we buy (structured data). The industry page describes the industrial collection service.
- `sitemap.xml` lists every page, and `robots.txt` points to it.
- The areas list comes from `src/config/areas.json`, the same list as the enquiry form. Add an area there and it appears on the page and in the business details.

## Do these, in order

1. **Put the website live.** Push, then run `cd /opt/blackgold-website && git pull` on the server. Nothing below works until the live site has these pages.
2. **Google Search Console** (search.google.com/search-console).
   - Add the domain `myblackgold.app`. Verify it with the DNS record Google gives you. If you choose the "HTML tag" method instead, copy only the code inside `content="..."` into `googleSiteVerification` in `src/config/site.json`, rebuild and deploy.
   - Submit the sitemap: `https://myblackgold.app/sitemap.xml`.
   - Use "URL inspection" → "Request indexing" for the home page, What we collect and For industry.
3. **Google Business Profile** (business.google.com). This has the biggest effect on "near me" and "in Chennai" searches and on the map results.
   - Name exactly **Black Gold**, with the same address and phone as the website footer: No. 22J, TVK Industrial Estate, Guindy, Chennai 600032, +91 70108 60788.
   - Website: `https://myblackgold.app`.
   - Categories: primary **Recycling center**, add **Waste management service**.
   - Add each oil as a product or service: used engine oil, hydraulic oil, transformer oil, waste cutting oil, coolant, oily water and sludge.
   - Add opening hours and real photos: the truck, measuring at a customer's site, the office.
   - After every collection, ask the customer for a Google review. Reviews move you up the map results.
   - Put the profile's share link into `sameAs` in `src/config/site.json`, then rebuild and deploy.
4. **Bing Webmaster Tools** (bing.com/webmasters): import from Google Search Console. Bing also feeds some AI search tools.
5. **Business listings.** Buyers in India search IndiaMART, JustDial, Sulekha and TradeIndia. List Black Gold on each with the same name, address and phone, and a link to the website. Add each listing's link to `sameAs` as well.
6. **Pollution Control Board.** If Black Gold holds TNPCB/CPCB authorisation for used oil, make sure it appears in the TNPCB Recyclers Directory and tell the web team. The website can then say so, which builds trust with factories.

## Getting into AI answers (GEO)

ChatGPT, Gemini, Perplexity and Google's AI answers quote sites that state facts plainly and that other sites agree with. The website now does its part:

- **`llms.txt`** (myblackgold.app/llms.txt): a plain summary of the business (what we buy, the 50-litre minimum, payment, areas, contact) and every page. Edit it in `src/llms.txt`; the build fills in the phone, email, office and areas from `src/config/`, and lists the pages from their titles and descriptions.
- **FAQ structured data**: the build turns the FAQ page's questions and answers into `FAQPage` data, so answer engines can quote them directly. Edit the questions in `src/pages/faq.html`; `npm run check` fails if the data and the page disagree.
- **Headings that say what the page is about**: "The used oil we buy in Chennai", "Industrial oil waste collection", "Selling used oil?".
- `robots.txt` lets every crawler in, including AI ones (GPTBot, PerplexityBot, Google-Extended). Keep it that way.

What only Black Gold can do, and matters more:

1. **Bing Webmaster Tools** (step 4 above). ChatGPT search and Copilot use Bing's index; a site Bing hasn't crawled can't be quoted there.
2. **The same name, address and phone everywhere**: Google Business Profile, JustDial, IndiaMART, Sulekha, TradeIndia, Facebook. AI answers trust facts that several sites agree on.
3. **Reviews** on Google Business Profile that mention what was collected and where ("collected 200 litres of engine oil from our Porur garage, paid by UPI").
4. **Mentions on other sites**: the TNPCB recyclers directory, local trade associations (garage owners, Ambattur and Guindy industrial estates), news about the business.
5. **Keep facts current.** If the minimum, payment or areas change, change them on the site the same day; answer engines repeat what they last read.

Once a month, ask ChatGPT, Gemini and Perplexity "Who buys used engine oil in Chennai?" and "How do I sell waste oil in Ambattur?", and note whether Black Gold appears.

## Measuring where enquiries come from

With `leadsEndpoint` set in `src/config/site.json`, every enquiry reaches the dashboard's **Leads** page with where the visitor came from: Google search, AI assistant (chatgpt.com, perplexity.ai, gemini.google.com…), Meta ads, business listings, WhatsApp or direct. Tag links you control so they show up by name:

| Link | Use |
| --- | --- |
| Google Business Profile website field | `https://myblackgold.app/?utm_source=gbp&utm_medium=organic` |
| JustDial / IndiaMART listing | `https://myblackgold.app/?utm_source=justdial&utm_medium=listing` (or `indiamart`) |
| QR code on the truck or flyers | `https://myblackgold.app/?utm_source=qr&utm_campaign=truck&enquiry=pickup` (`enquiry=pickup` opens the form) |
| Meta ads | see `docs/marketing/META-ADS.md` in the main app repository |

## What to expect

Google usually finds new pages within days of step 2, but moving up the results takes weeks to months. Map results depend mostly on the Business Profile, reviews and matching listings. Nobody can guarantee first place; steps 2 and 3 matter most.
