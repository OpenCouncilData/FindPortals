## Find OpenCouncilData sources

This script produces a JSON list of open data portals used by councils in Australia. It combines some known portals with heuristics for detecting new ones on portals such as data.gov.au and data.sa.gov.au. It then uploads the data (if authorised) to Cloudant.

The results can be accessed at:

* https://opencouncildata.cloudant.com/councils/_all_docs?include_docs=true&conflicts=true
* https://opencouncildata.cloudant.com/councils/_design/platforms/_view/ckan
* https://opencouncildata.cloudant.com/councils/_design/platforms/_view/socrata
