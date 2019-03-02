/*
 * Request handlers
 *
 */

// Dependencies
const helpers = require('./helpers');
const _data = require('./data');

// Container for the handlers
const handlers = {};

// Not-found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

// Users handler
handlers.users = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if(acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the users methods
handlers._users = {};

handlers._users.post = (data, callback) => {
  // Check that all required fields are filled out
  const name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
  // user email
  const email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
  const address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false;
  const password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

 if (name && email && address && password) {
  // Make sure the user doesn't already exist
  _data.read('users', email, (err,data) => {
    if(err) {
      // this user doest not exist
      // Hash the password
      const hashedPassword = helpers.hash(password);

      // Create the user object
      if(hashedPassword) {
        const userObject = {
          'name':name,
          'email': email,
          'address': address,
          'hashedPassword': hashedPassword
        }

        // Store the user
        _data.create('users',email,userObject, function(err){
          if(!err) {
            callback(200, {"Success":"Account successfully created"});
          } else {
            callback(500, {'Error': 'Could not create the new user'});
          }
        });
      } else {
        callback(500, {'Error': 'Could not hash the user\'s password'});
      }
    } else {
      // User already exists
      callback(400, {'Error': 'An account with this email already exists'});
    }
  });
 } else {
  callback(400, {'Error': 'Missing required fields'});
 }
};

handlers._users.get = (data, callback) => {
  // Check that email is valid
  const email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;

  if(email) {
    // Get the token from headers
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
      if(tokenIsValid) {
        // Lookup the user
        _data.read('users', email, (err, data) => {
          if(!err && data) {
            // Remove the hashedPassword from the userObject before returning it to the requester
            delete data.hashedPassword;
            callback(200, data);
          } else {
            callback(404);
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
};

handlers._users.put = (data, callback) => {
  // Check for required field
  const email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;

  // Check for optional fields
  const name = typeof(data.payload.name) == 'string' && data.payload.name.trim().length > 0 ? data.payload.name.trim() : false;
  const address = typeof(data.payload.address) == 'string' && data.payload.address.trim().length > 0 ? data.payload.address.trim() : false;
  const password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  // Error if email in invalid
  if(email) {
    // Error if nothing is sent to update
    if(name || address || password) {
      // Get the token from headers
      const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

      // Verify that the given token is valid for the email
      handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
        if(tokenIsValid) {
          // Lookup the user
          _data.read('users', email, (err, userData) => {
            if(!err && userData) {
              // Update the fields if necessary
              if(name) {
                userData.name = name;
              }
              if(address) {
                userData.address = address;
              }
              if(password) {
                userData.hashedPassword = helpers.hash(password);
              }
              // Store the update user
              _data.update('users', email, userData, (err) => {
                if(!err) {
                  callback(200);
                } else {
                  callback(500, {'Error': 'Could not update the user.'});
                }
              });
            } else {
              callback(400, {'Error': 'Specified user does not exist'});
            }
        });
      } else {
          callback(403, {"Error" : "Missing required token in header, or token is invalid."});
        }
    });

    } else {
      callback(400, {'Error': 'Missing fields to update'});
    }
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
};

handlers._users.delete = (data, callback) => {
  // Check that the email is valid
  const email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;
  if(email) {
    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token,email,function(tokenIsValid){
      if(tokenIsValid){
        // Lookup the user
        _data.read('users', email, (err, userData) => {
          if(!err && userData) {
            _data.delete('users', email, (err) => {
              if(!err) {
                // Delete all of the items in the user's cart
                const userCart = typeof(userData.cart) == 'object' && userData.cart instanceof Array ? userData.cart : false;
                const itemsToDelete = userCart.length;
                if(itemsToDelete > 0) {
                  let itemsDeleted = 0;
                  let deletionErrors = false;
                  // Loop through the cart
                  userCart.forEach((item) => {
                    // Delete the item
                    _data.delete('carts', item, (err) => {
                      if(err) {
                        deletionErrors = true;
                      }
                      itemsDeleted++;
                      if(itemsDeleted == itemsToDelete) {
                        if(!deletionErrors) {
                          callback(200);
                        } else {
                          callback(500, {'Error': "Errors encountered while attempting to delete all of the user's items. All items may not have been deleted from the system successfully."})
                        }
                      }
                    });
                  });
                } else {
                  callback(200);
                }
              } else {
                callback(500, {'Error': 'Could not delete the specified user'});
              }
            });
          } else {
            callback(400, {'Error': 'Could not find the specified user'});
          }
        });
      } else {
        callback(403, {"Error" : "Missing required token in header, or token is invalid."});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
};

// Tokens
handlers.tokens = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if(acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the token methods
handlers._tokens = {};

handlers._tokens.post = (data, callback) => {
  const email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
  const password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  if(email && password) {
    // Lookup the user who matches that email
    _data.read('users', email, (err, userData) => {
      if(!err && userData) {
        // Hash the sent password, and compare it to the password stored in the user object
        const hashedPassword = helpers.hash(password);
        if(hashedPassword == userData.hashedPassword) {
          // If valid, create a new token with a random name. Set an expiration date 1 hour in the future.
          const tokenId = helpers.createRandomString(20);
          const expires = Date.now() + 1000 * 60 * 60;
          const tokenObject = {
            'email': email,
            'id': tokenId,
            'expires': expires
          };

          // Store the token
          _data.create('tokens', tokenId, tokenObject, (err) => {
            if(!err) {
              callback(200, tokenObject);
            } else {
              callback(500, {'Error': 'Could not create new token'});
            }
          });
        } else {
          callback(400, {'Error': 'Password dit not match the specified user\'s stored password'});
        }
      } else {
        callback(400, {'Error': 'Could not find the specified user'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required fields'});
  }
};

handlers._tokens.get = (data, callback) => {
  // Check that id is valid
  const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id) {
    // Lookup the token
    _data.read('tokens', id, (err, tokenData) => {
      if(!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field, or field invalid.'});
  }
};

handlers._tokens.put = (data, callback) => {
  const id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  const extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
  if(id && extend) {
    // Lookup the existing token
    _data.read('tokens', id, (err, tokenData) => {
      if(!err && tokenData) {
        // Check to make sure that the token isn't already expired
        if(tokenData.expires > Date.now()) {
          // Set the expiration date an hour from now.
          tokenData.expires = Date.now() + 1000 * 60 * 60;
          // Store the new updates
          _data.update('tokens', id, tokenData, (err) => {
            if(!err) {
              callback(200);
            } else {
              callback(500, {'Error': 'Could not update the token\'s expiration'});
            }
          });
        } else {
          callback(400, {'Error': 'The token is already expired and cannot be extended'});
        }
      } else {
        callback(400, {'Error': 'Could not find the specified token'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field(s) or field(s) are invalid'});
  }
};

handlers._tokens.delete = (data, callback) => {
  // Check that id is valid
  const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id) {
    // Lookup the token
    _data.read('tokens', id, (err, tokenData) => {
      if(!err && tokenData) {
        // Delete the token
        _data.delete('tokens', id, (err) => {
          if(!err) {
            callback(200);
          } else {
            callback(500, {'Error': 'Could not delete the specified token'});
          }
        });
      } else {
        callback(400, {'Error': 'Could not find the specified token'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field or field invalid'});
  }
};

// Verify if a given token is currently valid for a given user
handlers._tokens.verifyToken = (id, email, callback) => {
  // Lookup the token
  _data.read('tokens', id, (err, tokenData) => {
    if(!err && tokenData) {
      // Check that the token is for the given user and is not expired
      if(tokenData.email == email && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};

// Pizza  handler
handlers.foods = (data, callback) => {
  var acceptableMethods = ['get'];
  if(acceptableMethods.indexOf(data.method) > -1){
    handlers._foods[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the foods method
handlers._foods = {};

handlers._foods.get = (data, callback) => {
  // record the user email
  const email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;

  if(email) {
    // Get the token from headers
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

    // Lookup the email by reading the token
    handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
      if(tokenIsValid) {
        // Lookup the foods
        _data.foods((err, data) => {
          if(!err && data) {
            callback(200, data);
          } else {
            callback(500, {'Error': 'Could not find the item'});
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in header, or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field or field invalid'});
  }
};


// Cart handler
handlers.cart = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if(acceptableMethods.indexOf(data.method) > -1) {
    handlers._cart[data.method](data, callback);
  } else {
    callback(405);
  }
};

handlers._cart = {};

// Add item to cart
handlers._cart.post = (data, callback) => {
  // Validate input
  const item = (typeof(data.payload.item) == 'number' || typeof(data.payload.item) == 'string') && (data.payload.item) != '' ? parseInt(data.payload.item) : false;

  const quantity = typeof(data.payload.quantity) == 'number' && data.payload.quantity >= 1 ? parseInt(data.payload.quantity) : false;
  if(item && quantity) {
    // Get token from headers
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Lookup the user email by reading the token
    _data.read('tokens', token, (err, tokenData) => {
      if(!err && tokenData) {
        const email = tokenData.email;
        _data.read('users', email, (err, userData) => {
          if(!err && userData) {
            const userCart = typeof(userData.cart) == 'object' && userData.cart instanceof Array ? userData.cart : [];
            const filleditem = helpers.createRandomString(20);

            // Lookup the item data
            _data.food(item, (err, itemData) => {
              if(!err && itemData) {
                // Create filledItem object including email
                const filledItemObject = {
                  'id': filleditem,
                  'email': email,
                  'item': itemData,
                  'item': item,
                  'quantity': quantity
                };
                // Save the object
                _data.create('carts', filleditem, filledItemObject, (err) => {
                  // Add filledItem to the user's object
                  if(!err) {
                    userData.cart = userCart;
                    userData.cart.push(filleditem);

                    // Save the new user data
                    _data.update('users', email, userData, (err) => {
                      if(!err) {
                        // Return the data about the new filled in-item
                        callback(200, filledItemObject);
                      } else {
                        callback(500, {'Error': 'Could not update the user cart with the new item'});
                      }
                    });
                  }
                  else {
                    callback(500, {'Error': 'Could not fill-in new item in the cart'});
                  }
                });
              } else {
                callback(400, {'Error': 'Could not find the specified item'});
              }
            });
          } else {
            callback(403);
          }
        });
      } else {
        callback(403);
      }
    });
  } else {
    callback(400, {'Error': 'Missing required input or input is invalid'});
  }
};

handlers._cart.get = (data, callback) => {
  const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;


  // Verify that the given token is valid and belongs to the user who filled-in the item
  _data.read('tokens', token, (err, tokenData) => {
    if(!err) {
      // Return filledItem data
      const email = tokenData.email;
      _data.read('users', tokenData.email, (err, userData) => {
        var cartItems = [];

        if(userData.cart == '' || userData.cart.length == 0)
          callback(200, {cartItems});
        userData.cart.map((cartId, i)=>{
          _data.read('carts', cartId, (err, cartData) => {
            _data.food(cartData.item, (err, foodData)=>{
              cartData.item = foodData;
              cartData.email = undefined;
              cartItems.push(cartData);
              if(cartItems.length == userData.cart.length)
                callback(200, {cartItems});
            });
          });
        });
      });
    } else {
      callback(403);
    }
  });
};

handlers._cart.put = (data, callback) => {
  // Check required fields
  const id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  const quantity = typeof(data.payload.quantity) == 'number' && data.payload.quantity % 1 === 0 && data.payload.quantity >= 1 ? data.payload.quantity : false;

  // Error if id or quantity are invalid
  if(id && quantity) {
    // Lookup the filled-in item
    _data.read('carts', id, (err, filledItemData) => {
      if(!err && filledItemData) {
        // Get the token that was sent in the request
        const token = typeof(data.headers.token) == 'string' ?  data.headers.token : false;
        // Update filledItem data
        filledItemData.quantity = quantity;

        // Store the update
        _data.update('carts', id, filledItemData, (err) => {
          if(!err) {
            callback(200);
          } else {
            callback(500, {'Error': 'Could not update the filled item'});
          }
        });
      } else {
        callback(400,  {'Error': 'filleditem does not exist'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field or field invalid'});
  }
};

handlers._cart.delete = (data, callback) => {
  // Check that id is valid
  const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if(id) {
    // Lookup the filled item
    _data.read('carts', id, (err, filledItemData) => {
      if(!err && filledItemData) {
        // Get the token that was sent in the request
        const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;

          // Delete the filled item data
        _data.delete('carts', id, (err) => {
          if(!err) {
            // Look the user object to get its cart
            _data.read('users', filledItemData.email, (err, userData) => {
              if(!err &&  userData) {
                const userCart = typeof(userData.cart) == 'object' && userData.cart instanceof Array ? userData.cart : false;
                // Remove the item from their cart
                const itemPosition = userCart.indexOf(id);
                if(itemPosition > -1)  {
                  userCart.splice(itemPosition, 1);
                  // Re-save the user's data
                  userData.cart = userCart;
                  _data.update('users', filledItemData.email, userData, (err) => {
                    if(!err) {
                      callback(200);
                    } else {
                      callback(500, {'Error': 'Could not update the user'});
                    }
                  });
                } else {
                  callback(500, {'Error': 'Could not find the item in the user\'s cart, so could not delete it'});
                }
              } else {
                callback(500,  {'Error': 'Could not find the user who put the item in the cart, so could not remove the item from their cart on the user object'});
              }
            });
          } else {
            callback(500, {'Error': 'Could not delete the specified filled item'});
          }
        });
      } else {
        callback(400, {'Error': 'Could not find the filled-item with the specified id'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing valid id'});
  }
};

// Orders handler
handlers.orders = (data, callback) => {
  const acceptableMethod = 'post';
  if(data.method == acceptableMethod) {
    handlers._orders[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the orders method
handlers._orders = {};

// Orders - POST
// Required data: email
// Optional data: none
handlers._orders.post = (data, callback) => {
  // Check that email is present
  const email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
  if(email) {
    // Get token from the header
    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, (tokenIsValid) => {
      if(tokenIsValid) {
        // Lookup the user
        _data.read('users', email, (err, userData) => {
          if(!err && userData) {
            // Check that user has items in the cart
            const userCart = typeof(userData.cart) == 'object' && userData.cart instanceof Array && userData.cart.length > 0 ? userData.cart : false;
            if(userCart) {
              // Total value to be paid in usd
              let totalAmount = 0;
              // Data to be sent in the receipt
              let receiptData = [];
              let checkErrors = false;

              let itemsToCheck = userCart.length;
              userCart.forEach((item) => {
                _data.read('carts', item, (err, itemData) => {
                  if(err || !itemData) {
                    checkErrors = true;
                  }
                  _data.food(itemData.item, (err, food)=>{

                      if(err) {
                        callback(500, {"Error":"Food not found"});
                      }else{
                        itemReceiptData = {
                          'name': food.name,
                          'price': food.price,
                          'quantity': itemData.quantity
                        }
                        totalAmount += itemReceiptData.price * itemReceiptData.quantity;
                        receiptData.push(itemReceiptData);
                        if(receiptData.length == itemsToCheck) {
                          if(!checkErrors) {
                            // Accept payment using stripe's API
                            helpers.acceptStripePayment(totalAmount, 'Pizza-Delivery for ' + userData.name, (err) => {
                              if(!err) {
                                // Send email through mailgun
                                const emailHtml = handlers._orders.format(receiptData, totalAmount);
                                helpers.sendMailgunEmail('Pizza-Delivery receipt for ' + userData.name, emailHtml, email, (err) => {
                                  if(!err) {
                                    callback(200);
                                  } else {
                                    callback(500, {'Error': 'Failed to send receipt e-mail'});
                                  }
                                });
                              } else {
                                callback(500, {'Error': 'Failed to accept payment'});
                              }
                            })
                          } else {
                            callback(500, {'Error': 'Errors encountered while attempting to generate the user\'s order'});
                          }
                        }
                      }
                  });
                });
              });
            } else {
              callback(400, {'Error': 'Specified user doesn\'t have any item in the cart'});
            }
          } else {
            callback(400, {'Error': 'Specified user does not exist'});
          }
        });
      } else {
        callback(403, {'Error': 'Missing required token in the header or token is invalid'});
      }
    });
  } else {
    callback(400, {'Error': 'Missing required field'});
  }
};

// Create HTML to send in the receipt email
handlers._orders.format = (data, totalAmount) => {
  let html = '';
  html += 'You ordered for <br><ul>';
  data.forEach((item) => {
    html += '<li>' + item.quantity + 'x ' + item.name + ': $' + item.quantity * item.price + '.00' + '</li>';
  });
  html += '</ul>'
  html += '<br><p><strong>Price: ' + totalAmount + '' + '</strong></p>'
  return html;
};

// Export the module
module.exports = handlers;
