## Find OpenCouncilData sources

This script produces a JSON list of open data portals used by councils in Australia. It combines some known portals with heuristics for detecting new ones on portals such as data.gov.au and data.sa.gov.au. It then uploads the data (if authorised) to Cloudant.

The results can be accessed at:

* https://opencouncildata.cloudant.com/councils/_all_docs?include_docs=true&conflicts=true
* https://opencouncildata.cloudant.com/councils/_design/platforms/_view/ckan
* https://opencouncildata.cloudant.com/councils/_design/platforms/_view/socrata
* https://opencouncildata.cloudant.com/councils/_design/platforms/_view/all


### Updating the list of states

In order to know which state a council belongs to, we look it up in the ABS ASGS list (http://www.abs.gov.au/AUSSTATS/abs@.nsf/DetailsPage/1270.0.55.003July%202016?OpenDocument).

1. `wget 'http://www.abs.gov.au/ausstats/subscriber.nsf/log?openagent&1270055003_lga_2016_aust_shape.zip&1270.0.55.003&Data%20Cubes&6A6A6E8944937276CA25802C00142DD2&0&July%202016&13.09.2016&Latest'`
2. `ogr2ogr -f CSV lgas.csv LGA_2016_AUST.shp`
