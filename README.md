# Caesar Predict V2.1.1

Football prediction dashboard powered by API-Football.

## Features
- Live football fixtures and team logos
- Home / Draw / Away prediction percentages
- Best Bet and confidence band
- Over / Under goal range
- Team form, H2H, goals and BTTS analysis
- Top Picks section
- Match search and league filters
- Mobile-friendly dashboard

## Render deployment
- Runtime: Node
- Root Directory: leave blank
- Build Command: `npm install`
- Start Command: `npm start`

## Environment variable
Set this on Render:

`API_FOOTBALL_KEY=YOUR_PRIVATE_API_KEY`

Never put your real API key in GitHub or in this README.

## API usage
The server keeps a short cache and the detailed analysis uses supported date-range fixture requests instead of the restricted `last` parameter.

## Version
V2.1.1

## Important
The prediction percentages are supplied by the football-data API and are not a guarantee of match results.
