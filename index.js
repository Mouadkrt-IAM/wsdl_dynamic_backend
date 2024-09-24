const express = require('express');
const axios = require('axios');
const https = require('https');
const xml2js = require('xml2js');
const xmlParser = new xml2js.Parser();

require('dotenv').config();

const app = express();
const HOST = process.env.HOST  || '0.0.0.0';
const PORT = process.env.PORT  || 3000;
const G_threeScale_URL = process.env.G_threeScale_URL;
const G_threeScale_remote_token = process.env.G_threeScale_remote_token;

// Create an HTTPS agent that accepts self-signed certificates
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // Disable SSL certificate validation
});


// Middleware to intercept GET requests
app.get('/', async (req, res) => {
    // Check if the 'wsdl' query parameter exists
	
	
	console.log("\n\nNew GET request received on / :");
	console.log("\nQUERY Params :");
	console.log(req.query);
	
	console.log("\nHEADERS :");
	console.log(req.headers);
	
	x_forwarded_host = req.headers['x-forwarded-host'];
	console.log('x-forwarded-host : ' + x_forwarded_host);
	
	authorization = req.headers['authorization'];
	console.log('authorization : ' + authorization);
	
	service_id = req.query.service_id
	console.log("3scale service_id : " + service_id);
	
	WS_URI = req.query.URI
	console.log("WS_URI : " + WS_URI);
	
	BE_location = "https://soatest.iamdg.net.ma:7002/" + WS_URI
	
    if ('wsdl' in req.query) {
        backend_usages_resp = await axios.get(G_threeScale_URL + "/admin/api/services/" + service_id +"/backend_usages.json?access_token=" + G_threeScale_remote_token, {httpsAgent : httpsAgent} );
		real_backend = backend_usages_resp.data.filter(b => b.backend_usage.path=='/')
		console.log("\nreal backend IDs : " + real_backend)
		real_backend_id = real_backend[0].backend_usage.backend_id
		
		backend_apis = await axios.get(G_threeScale_URL + "/admin/api/backend_apis.json?access_token=" + G_threeScale_remote_token, {httpsAgent:httpsAgent} );
		backend_api = backend_apis.data.backend_apis.filter(b => b.backend_api.id==real_backend_id);
		console.log("\nreal backend : " + backend_api)
		console.log(backend_api);
		real_backend_url = backend_api[0].backend_api.private_endpoint
		console.log(backend_api[0].backend_api.private_endpoint);
		real_backend_url
		WSDL_URL_BACKEND = real_backend_url + "?wsdl"
	
	    try {
            // Make an HTTP call to the backend service (The API provider hosting the WSDL file)
            // @todo : replace the hard coded URL below with the real 3scale backend for the targeted WS
            const response = await axios.get(WSDL_URL_BACKEND, {
				headers		: {'Authorization':authorization},
				httpsAgent	: httpsAgent
				});
            // Send the response from the backend to the client
            console.log("\nSending back WSDL as read from : " + WSDL_URL_BACKEND);
            res.set('Content-Type', 'application/wsdl+xml');
            
			xmlParser.parseString(response.data, (err, result) => {
			if (err) {
				console.error(err);
				return;
			}
			// Log the parsed result
			console.dir(result['wsdl:definitions']['wsdl:service'][0]['wsdl:port'][0]['soap:address'][0].$.location);
			result['wsdl:definitions']['wsdl:service'][0]['wsdl:port'][0]['soap:address'][0].$.location = BE_location
			const builder = new xml2js.Builder();
			updatedWSDL = builder.buildObject(result)
			console.log("\nUpdated WSDL : \n" + updatedWSDL);
			res.send(updatedWSDL);
		});
        } catch (error) {
            // Handle errors from the backend service
            console.error('Error making backend request:', error);
            res.status(500).send( 'Failed to fetch WSDL from backend : ' + error );
        }
    } else {
        // If 'wsdl' is not present, send a default response
        res.json({ message: 'No WSDL parameter provided : HTTP GET method is only designed here to allow WSDL files retreival. Contact administrators for more info.' });
    }
});

// Start the server
app.listen(PORT, HOST,  () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
	console.log("G_threeScale_URL : " + G_threeScale_URL);
	
});
