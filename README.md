# Caesar Predict V2.1.3

Football prediction dashboard powered by API-Football.

## V2.1.3 changes
- Groups fixtures under their league headings.
- Keeps league filters for Premier League, La Liga and Champions League.
- Free-plan API calls are deliberately spaced to respect the 10 requests/minute limit.
- Only a small number of prediction endpoints are requested per page load; fixtures without API prediction coverage are labelled clearly instead of showing fake data.
- Detailed analysis requests are sequential and cached.
- Uses the fixture's season for team-history analysis.

## Render
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Root Directory: blank

## Environment variable
Set `API_FOOTBALL_KEY` in Render. Never commit the real key to GitHub.

## Important free-plan limits
API-Football's current Free plan provides 100 requests/day and a 10 requests/minute limit. Caesar Predict therefore uses caching and a request queue. Some competitions/fixtures may not have prediction coverage; those are shown as unavailable rather than invented.
