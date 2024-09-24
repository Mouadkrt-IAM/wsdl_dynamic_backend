const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to intercept GET requests
app.get('/', async (req, res) => {
    // Check if the 'wsdl' query parameter exists
    if ('wsdl' in req.query) {
        WSDL_URL_BACKEND = "http://webservices.oorsprong.org/websamples.countryinfo/CountryInfoService.wso?WSDL"
        try {
            // Make an HTTP call to the backend service (The API provider hosting the WSDL file)
            // @todo : replace the hard coded URL below with the real 3scale backend for the targeted WS
            const response = await axios.get(WSDL_URL_BACKEND);
            // Send the response from the backend to the client
            console.log("Sending back WSDL as read from : " + WSDL_URL_BACKEND);
            res.set('Content-Type', 'application/wsdl+xml');
            res.send(response.data);
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
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});