# Query plants database

AS a user
WHEN I have an address selected
AND I have at least one zone active
I WANT a panel on the right side to display a list of plants that are appropriate to the selected zones

## Plants API

### Endpoints

GET /api/v2/docs-raw — Full OpenAPI 3.0 spec as JSON
GET /plant-fields.json — Every field, attribute, and allowed value with descriptions
GET /api/v2/plants?includeImages=true — Browse all 1,361 plants as JSON
GET /api/v2/attributes/hierarchical — Full attribute tree with allowed values
GET /api/v2/plants/1b78126d-... — Test plant (Glossy abelia) with all values + images

Described here:
https://lwf-api.vercel.app/

## Implementation Plan

