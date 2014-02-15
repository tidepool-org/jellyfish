/*
  == BSD2 LICENSE ==
  Copyright (c) 2014, Tidepool Project
  
  This program is free software; you can redistribute it and/or modify it under
  the terms of the associated License, which is identical to the BSD 2-Clause
  License as published by the Open Source Initiative at opensource.org.
  
  This program is distributed in the hope that it will be useful, but WITHOUT
  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
  FOR A PARTICULAR PURPOSE. See the License for more details.
  
  You should have received a copy of the License along with this program; if
  not, you can obtain one from Tidepool Project at tidepool.org.
  == BSD2 LICENSE ==
 */

var hakken = require('hakken')({ host: 'localhost:8000' });
var userApiClient = require('user-api-client');

(function () {
  var discovery = hakken.client();
  var userApiWatch;
  var client;

  discovery.start(function (err) {
    if (err != null) {
      throw err;
    }
    userApiWatch = discovery.randomWatch('user-api');
    userApiWatch.start(function (error) {
      if (error != null) {
        throw error;
      }

      client = userApiClient.client(
        {
          serverName: 'loginScript',
          serverSecret: 'This is a shared server secret'
        },
        userApiWatch
      );
      go();
    });
  });

  function go() {
    client.login('loginAndCheckGroups', '123456789', function(err, token){
      console.log('The token is:', token);
    });
  }
})();