/* jshint esnext:true */
var requestp = require('request-promise');
var URI = require('urijs');
var Promise = require('bluebird');
var orgInfo = {};
var Cloudant = require('cloudant');

// can be queried as https://opencouncildata.cloudant.com/councils/_design/platforms/_view/ckan
//                   https://opencouncildata.cloudant.com/councils/_design/platforms/_view/socrata
// 

function uploadToCloudant(orgInfo) {
    var docs = Object.keys(orgInfo).map(key => {
        var doc = orgInfo[key]; // destructive modification, but so what?
        doc._id = key;
        return doc;
    });

    console.log(docs);
    //return;
    var config = require('./config.json');

    var cloudant = Cloudant({ 
        account: config.cloudant.account, 
        password: config.cloudant.password 
    });
    var db = cloudant.use(config.cloudant.database);
    db.bulk({docs: docs}, undefined, (err, body) => {
        if (err)
            console.log(err.reason);
    });
}


function cleanCouncilName(name) {
    var re = /\s*(^City of|^Shire of|\(Local Council\)|City|Shire|Rural|Municipal|Council)\s*/;
    return name.replace(re, '').replace(re, '').replace(re, '');
}

/* Connect  to a CKAN endpoint and build a list of councils that have organisations within that portal. */
function getCouncilOrgs(api) {
    
    //console.log('Short name,Date,LGA_Name');
    return requestp({
        url: api + 'action/organization_list?all_fields=true', // all_fields gets us the title (and a million things we don't need)
        json: true
    }).then(results => results.result
        // we have to be careful not to double count sites that get federated to data.gov.au
        .filter(org => api.match('brisbane') ? true : (!org.title.match(/Brisbane/) && org.title.match(/city|shire|municipal/i)))
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
            if (api.match('brisbane') || org.title.match(/gold coast|logan|sunshine coast|noosa/i))
                orgInfo[orgUrl].state = 'Queensland';
            else if (api.match('data.sa'))
                orgInfo[orgUrl].state = 'South Australia';
            else if (api.match('data.nsw') || org.title.match('Mosman'))
                orgInfo[orgUrl].state = 'New South Wales';
            else if (org.title.match(/launceston|hobart|glenorchy/i))
                orgInfo[orgUrl].state = 'Tasmania';
            else if (org.title.match(/act government/i))
                orgInfo[orgUrl].state = 'ACT';
            else
                orgInfo[orgUrl].state = 'Victoria';

            return {
                name: org.name,
                api: api,
                type: 'ckan'
            };
        })

    );
}

Promise.all([
    getCouncilOrgs('https://data.gov.au/api/3/'),
    getCouncilOrgs('https://data.sa.gov.au/data/api/3/'),
    getCouncilOrgs('http://data.nsw.gov.au/data/api/3/')/*,
    getCouncilOrgs('https://data.brisbane.qld.gov.au/data/api/3/')*/
]).then(() => {
    // Add the councils that have their own portal. There's not really a way to detect these automatically.
    orgInfo['https://data.brisbane.qld.gov.au/'] = {
        title: 'Brisbane City Council',
        shortTitle: 'Brisbane',
        type: 'ckan',
        state: 'Queensland'
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

}).then(() => uploadToCloudant(orgInfo));