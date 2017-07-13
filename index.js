/* jshint node:true,esnext:true */
'use strict';
var requestp = require('request-promise');
var URI = require('urijs');
var Promise = require('bluebird');
var Cloudant = require('cloudant');
var fs = require('fs');
var d3 = require('d3-dsv');


function def(a, b) {
    return a !== undefined ? a : b;
}


function uploadToCloudant(orgInfo) {
    var docs = Object.keys(orgInfo).map(key => {
        var doc = orgInfo[key]; // destructive modification, but so what?
        doc._id = key;
        doc._rev = revIds[key];
        //console.log(doc);
        return doc;
    });

    console.log(docs.map(doc => doc.title).join(','));
    console.log(`${docs.length} councils.`);
    //console.log(docs);
    //return;
    var config = require('./config.json');

    var cloudant = Cloudant({ 
        account: config.cloudant.account, 
        password: config.cloudant.password 
    });
    var db = cloudant.use(config.cloudant.database);
    db.bulk({docs: docs}, er => {

        if (er) {
            // don't know what this does for us.
            //console.error('ERROR');
        }
    }, (err, body) => {
        //console.log(body);        
        if (err || Array.isArray(body) && body[0].error)
            console.log(body);
        else
            console.log('Uploaded portals info to Cloudant.');
    });
}


function cleanCouncilName(name) {
    var re = /\s*(^City of|^Shire of|\(Local Council\)|Regional Council|City|Shire|Rural|Municipal|Council)\s*/;
    return name.replace(re, '').replace(re, '').replace(re, '');
}

function getStateFromName(shortTitle) {
    for (let row of lgas) {
        if (row.LGA_NAME16.replace(/ \(.*\)$/, '').replace(/-/g, ' ') === shortTitle.replace(/-/g, ' ')) {
            console.log(`${shortTitle} ==> ${row.STE_NAME16}`);
            return row.STE_NAME16;
        }
    }
    console.warn(`!! Unable to identify ${shortTitle}`);
}

/* Connect  to a CKAN endpoint and build a list of councils that have organisations within that portal. */
function getCouncilOrgs(api) {
    const councilRegex = /\b(city|shire|municipal|regional council)\b/i;
    //console.log('Short name,Date,LGA_Name');
    return requestp({
        url: api + 'action/organization_list?all_fields=true', // all_fields gets us the title (and a million things we don't need)
        json: true
    }).then(results => results.result
        // we have to be careful not to double count sites that get federated to data.gov.au
        .filter(org => {
            if (org.title.match(/council/) && !org.title.match(councilRegex)) {
                console.log('Warning: Did we miss ' + org.title + '?');
            }
            return true;
        })
        .filter(org => api.match('brisbane') ? true : (!org.title.match(/Brisbane/) && org.title.match(councilRegex)))
        //.filter(org => org.name === 'city-of-greater-geelong')
        .filter(org => { 
            //console.log(`${org.name},${org.created},${org.title}`);
            // Remove Socrata sites that are federated to data.gov.au.
            return org.name !== 'act-government' && org.name !== 'cityofmelbourne';  
            //return true;
            })
        .map(org => {
            var orgUrl = api.replace('api/3/', 'organization/' + org.name);
            orgInfo[orgUrl] = {
                api: api,
                title: api.match('brisbane') ? 'Brisbane City Council' : org.title,
                shortTitle: api.match('brisbane') ? 'Brisbane' : cleanCouncilName(org.title),
                type: 'ckan'
            };
            // There is no explicit state metadata, so we have to generate that here.
            if (api.match('brisbane'))// || org.title.match(/gold coast|logan|sunshine coast|noosa|moreton bay/i))
                orgInfo[orgUrl].state = 'Queensland';
            else if (api.match('data.sa'))
                orgInfo[orgUrl].state = 'South Australia';
            else if (api.match('data.nsw') || org.title.match('Mosman'))
                orgInfo[orgUrl].state = 'New South Wales';
            //else if (org.title.match(/launceston|hobart|glenorchy/i))
            //    orgInfo[orgUrl].state = 'Tasmania';
            else if (org.title.match(/act government/i))
                orgInfo[orgUrl].state = 'ACT';
            else 
                orgInfo[orgUrl].state = def(getStateFromName(orgInfo[orgUrl].shortTitle), 'Unknown');

            return {
                name: org.name,
                api: api,
                type: 'ckan'
            };
        })

    );
}


var orgInfo = {}, revIds = {};
// get rev ids of portals in the existing Cloudant list, required for the later bulk update
function getExistingList() {
    return requestp({
        url: 'https://opencouncildata.cloudant.com/councils/_design/platforms/_view/all',
        json: true
    }).then(results => {
        results.rows.forEach(row => revIds[row.id] = row.key._rev);
    });
}


var lgas = d3.csvParse(fs.readFileSync('lgas.csv').toString());

Promise.all([
    getExistingList(),
    getCouncilOrgs('https://data.gov.au/api/3/'),
    getCouncilOrgs('https://data.sa.gov.au/data/api/3/'),
    getCouncilOrgs('http://data.nsw.gov.au/data/api/3/'),
    getCouncilOrgs('http://catalogue.beta.data.wa.gov.au/api/3/')/*,
    getCouncilOrgs('https://data.brisbane.qld.gov.au/data/api/3/')*/
]).then(() => {
    // Add the councils that have their own portal. There's not really a way to detect these automatically.
    orgInfo['https://data.brisbane.qld.gov.au/'] = {
        title: 'Brisbane City Council',
        shortTitle: 'Brisbane',
        type: 'ckan',
        state: 'Queensland',
        api: 'https://data.brisbane.qld.gov.au/data/api/3/'
    };
    orgInfo['http://data.melbourne.vic.gov.au'] = {
        api: 'http://data.melbourne.vic.gov.au',
        title: 'City of Melbourne',
        shortTitle: 'Melbourne',
        state: 'Victoria',
        type: 'socrata'
    };
    orgInfo['http://data.act.gov.au'] = {
        api: 'http://data.act.gov.au',
        title: 'ACT Government',
        shortTitle: 'ACT',
        state: 'ACT',
        type: 'socrata'
    };
    orgInfo['https://data.sunshinecoast.qld.gov.au'] = {
        api: 'https://data.sunshinecoast.qld.gov.au',
        title: 'Sunshine Coast Council',
        shortTitle: 'Sunshine Coast',
        state: 'Queensland',
        type: 'socrata'
    };

}).then(() => {
    //console.log(orgInfo['https://data.gov.au/organization/moreton-bay-regional-council']);
})
.then(() => {
    // Also write the file to disk for convenience.
    var jsonfile = require('jsonfile');
 
    jsonfile.writeFile('orginfo.json', orgInfo, { spaces: 2}, function (err) {
      if (err)
        console.error(err);
    })
}).then(() => uploadToCloudant(orgInfo));