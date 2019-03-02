/*
 * Helpers for various tasks
 *
 */

// Dependencies
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const config = require('./config');

// Container for the helpers
const helpers = {};

// Parse a JSON string into an object, it doesn't throw errors, only returns empty object in case of one
helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch(e) {
    return {};
  }
};

// Create a SHA256 hash
helpers.hash = (str) => {
  if(typeof(str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

// Create a string of random alphanumeric characters, of a given length
helpers.createRandomString = (strLength) => {
  strLength = typeof(strLength) == 'number' && strLength > 0 ? strLength : false;
  if(strLength) {
    // Define all the characters that could go into a string
    const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // Define the final string
    var str = '';
    for(i = 1; i <= strLength; i++) {
      // Get a random character from the possibleCharacters string
      const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      // Append this character to the string
      str += randomCharacter;
    }
    // Return the final string
    return str;
  } else {
    return false;
  }
};

// Accept payment using stripe
helpers.acceptStripePayment = (amount, description, callback) => {
  // Validate parameter
  amount = typeof(amount) == 'number' && amount > 0 ? amount : false;
  if(amount) {
    // Configure the request payload
    const payload = {
      'amount': amount * 100,
      'currency': 'usd',
      'description': description,
      'source': 'tok_br'
    };
    const stringPayload = querystring.stringify(payload);

    // Configure the request details
    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.stripe.com',
      'method': 'POST',
      'path': '/v1/charges',
      'auth': config.stripeApiKey + ':',
      'headers' : {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      // Grab the status of the sent request
      const status = res.statusCode;
      // Callback successfully if the request went through
      if(status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status code returned was: ' + status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', (e) => {
      callback(e.message);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
  } else {
    callback("Given parameter is missing or invalid");
  }
};

// Send email via Mailgun
helpers.sendMailgunEmail = (subject, html, to, callback) => {
  // Validate parameter
  subject = typeof(subject) == 'string' ? subject : false;
  html = typeof(html) == 'string' ? html : false;
  to = typeof(to) == 'string' ? to : false;
  if(subject && html && to) {
    // Configure the request payload
    const payload = {
      'from': config.mailgunFrom,
      'to': to,
      'subject': subject,
      'html': html
    };
    const stringPayload = querystring.stringify(payload);

    // Configure the request details
    const requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.mailgun.net',
      'method': 'POST',
      'path': '/v3/' + config.mailgunSandboxDomain + '/messages',
      'auth': 'api:' + config.mailgunApiKey,
      'headers' : {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload)
      }
    };

    // Instantiate the request object
    const req = https.request(requestDetails, (res) => {
      // Grab the status of the sent request
      const status = res.statusCode;
      // Callback successfully if the request went through
      if(status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status code returned was: ' + status);
      }
    });

    // Bind to the error event so it doesn't get thrown
    req.on('error', (e) => {
      callback(e.message);
    });

    // Add the payload
    req.write(stringPayload);

    // End the request
    req.end();
  } else {
    callback("Given parameter is missing or invalid");
  }

};

// Export the module
module.exports = helpers;
