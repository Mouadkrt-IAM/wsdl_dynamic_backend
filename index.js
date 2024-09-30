const express = require('express');
const axios = require('axios');
const https = require('https');
const xml2js = require('xml2js');

//const stripPrefix = xml2js.processors.stripPrefix;
const xmlParser = new xml2js.Parser(
/*{ tagNameProcessors: [xml2js.processors.stripPrefix]}*/
);

require('dotenv').config();

const app = express();
const HOST = process.env.HOST  || '0.0.0.0';
const PORT = process.env.PORT  || 3000;
const G_threeScale_URL = process.env.G_threeScale_URL;
const G_threeScale_remote_token = process.env.G_threeScale_remote_token;
const DEBUG = process.env.DEBUG  || false;

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Disable SSL certificate validation
});


// Middleware to intercept GET requests
app.get('/', async (req, res) => {
	
	 console.log("debug : " + DEBUG)
	 
    // Check if the 'wsdl' query parameter exists
	
	
	console.log("\n\n----------------------------------------\nNew GET request received on / :");
	console.log("\nQUERY Params :");
	console.log(req.query);
	
	console.log("\nHEADERS :");
	console.log(req.headers);
	
	x_forwarded_host = req.headers['x-forwarded-host'];
	console.log('\nx-forwarded-host : ' + x_forwarded_host);
	
	x_forwarded_host_3scale = req.headers['x-forwarded-host-3scale'];
	
	
	/*if( x_forwarded_host_3scale == null || (typeof x_forwarded_host_3scale === "string" && x_forwarded_host_3scale.trim().length === 0) ) {
		console.log('\nx-forwarded-host-3scale null or empty ! Using  default : soa.iamdg.net.ma');
		x_forwarded_host_3scale = "soa.iamdg.net.ma:7070"
		x_forwarded_host_3scale = x_forwarded_host
		
	 }*/
	 
	console.log('x-forwarded-host-3scale : ' + x_forwarded_host_3scale);
	
	authorization = req.headers['authorization'];
	console.log('\nauthorization : ' + authorization);
	
	service_id = req.query.service_id
	console.log("\n3scale service_id : " + service_id);
	
	WS_URI = req.query.URI
	console.log("\nWS_URI : " + WS_URI);
	
	//BE_location = "https://soatest.iamdg.net.ma:7002/" + WS_URI
	BE_location = "https://" + x_forwarded_host_3scale + "/" + WS_URI
	
    if ('wsdl' in req.query) {
		
        backend_usages_resp = await axios.get(G_threeScale_URL + "/admin/api/services/" + service_id +"/backend_usages.json?access_token=" + G_threeScale_remote_token, {httpsAgent : httpsAgent} );
		real_backend = backend_usages_resp.data.filter(b => b.backend_usage.path=='/')
		real_backend_id = real_backend[0].backend_usage.backend_id
		
		backend_apis = await axios.get(G_threeScale_URL + "/admin/api/backend_apis.json?access_token=" + G_threeScale_remote_token, {httpsAgent:httpsAgent} );
		backend_api = backend_apis.data.backend_apis.filter(b => b.backend_api.id==real_backend_id);
		console.log("\nreal backend : ")
		console.log(backend_api);
		real_backend_url = backend_api[0].backend_api.private_endpoint
		console.log("private_endpoint : " + backend_api[0].backend_api.private_endpoint);
		WSDL_URL_BACKEND = real_backend_url + "?wsdl"
		console.log("WSDL_URL_BACKEND before update : \n" + WSDL_URL_BACKEND);
		
		// Now that we have the Full URL of teh WSDL file at the backend, let's check if we need an http basic auth in order to retreive it :
		// Oups, seems like we don't even need this, since the 3sacle header modifiction is applied before we the call is redirected to this code
		// So the 'authorization' above, are the ones set after the 'headers" modification policy is executed !
		
		/*policies = await axios.get(G_threeScale_URL + "/admin/api/services/" + service_id +"/proxy/policies.json?access_token=" + G_threeScale_remote_token, {httpsAgent:httpsAgent} );
		console.log("3scale policies for the curent service : \n");
		console.log(policies.data.policies_config);
		console.log("Check if the WS require an http basic auth ...");
		headers_policy = policies.data.policies_config.filter(p =>  p.name=='headers' && p.enabled==true)
		console.log("Found " + headers_policy.length + " active 'header' policy");
		if(headers_policy.length>0) {
			BE_BasicAuth = headers_policy[0].configuration.request[0].value
			console.log("with basic auth : " + BE_BasicAuth);
		}*/
				
		
	    try {
            // Make an HTTP call to the backend service (The API provider hosting the WSDL file)
            const response = await axios.get(WSDL_URL_BACKEND, {
				headers		: {'Authorization':authorization},
				httpsAgent	: httpsAgent
				});
            
            res.set('Content-Type', 'application/wsdl+xml');
            
			xmlParser.parseString(response.data, (err, result) => {
			if (err) {
				if(DEBUG) console.error(err);
				return;
			}
			
			// Log the parsed result
			console.log("\n Locating xml node *:definitions\\*:service\\*:port\\*:address without any tagname dependency (Backend implementation) :");
			definitions_key = Object.keys(result).filter(k => k.includes(':definitions')).pop();
			console.log("definitions tag found : " + definitions_key);
			
			service_key = Object.keys(result[definitions_key]).filter(k => k.includes(':service')).pop();
			console.log("service tag found : " + service_key);
			
			port_key = Object.keys(result[definitions_key][service_key][0]).filter(k => k.includes(':port')).pop();
			console.log("port tag found : " + port_key);
			
			address_key = Object.keys(result[definitions_key][service_key][0][port_key][0]).filter(k => k.includes(':address')).pop();
			console.log("adresse tag found " + address_key);
			
			oldLocation = result[definitions_key][service_key][0][port_key][0][address_key][0].$.location
			result[definitions_key][service_key][0][port_key][0][address_key][0].$.location = BE_location
			const builder = new xml2js.Builder();
			updatedWSDL = builder.buildObject(result)
			//console.log("\nUpdated WSDL : \n" + updatedWSDL);
			// Send the response from the backend to the client
            console.log("\nSending back WSDL as served from : " + WSDL_URL_BACKEND + ", with location updated from :\n"+ oldLocation + "\nto :\n" + BE_location);
			res.send(updatedWSDL);
		});
        } catch (error) {
            // Handle errors from the backend service
            if(DEBUG) console.error('Error making backend request:', error);
            res.status(500).send( 'Failed to fetch WSDL from backend : ' + error );
        }
    } else {
        // If 'wsdl' is not present, send a default response
        res.json({ message: 'No WSDL parameter provided : HTTP GET method is only designed here to allow WSDL files retreival. Contact administrators for more info.' });
    }
});

// Start the server
app.listen(PORT, HOST,  () => {
	console.log("wsdl-dynamic-backend v0.2");
    console.log(`Server is running on http://${HOST}:${PORT}`);
	console.log("G_threeScale_URL : " + G_threeScale_URL);
	
});
