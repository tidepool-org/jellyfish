/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var bows = require('bows');
var config = require('../config.js');
var platformClient = require('tidepool-platform-client');
var purl = require('purl-parser');
var $ = require('jquery');

var api = {
  token: null,
  log: bows('Api'),

  init: function(callback) {
    this.token = this._getTokenFromUrl() || null;
    // No-op, override to listen to change
    this.onAuthenticationChange = function() {};
    this.log('Initialized');

    var localStore = require('tidepool-platform-client/lib/inMemoryStorage.js')();
    if (this.token != null) {
      localStore.setItem('authToken', this.token);
    }
    this.tidepool = platformClient(
      {
        host: config.API_HOST,
        metricsSource: config.SERVICE_NAME,
        metricsVersion: config.VERSION,
        localStore: localStore
      }
    );
    tidepool.init(callback);
  },

  isAuthenticated: function() {
    return this.tidepool.isLoggedIn();
  },

  _getTokenFromUrl: function() {
    return purl().param('token');
  },

  // Wrapper around `$.ajax({type: 'GET'})` for API,
  _get: function(uri, callback) {
    var self = this;
    $.ajax({
      url: uri,
      type: 'GET',
      headers: {
        'x-tidepool-session-token': this.token
      }
    })
    .done(function(data, textStatus, xhr) {
      if (typeof callback === 'function') {
        callback(null, data);
      }
    })
    .fail(function(xhr) {
      self._handleFailedRequest(xhr, callback);
    });
  },

  _handleFailedRequest: function(xhr, callback) {
    if (xhr.status === 401) {
      this._handleUnauthorizedResponse();
    }
    if (typeof callback === 'function') {
      var error = this._xhrToErrorObject(xhr);
      callback(error);
    }
  },

  _handleUnauthorizedResponse: function() {
    this.token = null;
    this.onAuthenticationChange(false);
  },

  _xhrToErrorObject: function(xhr) {
    var error = {};
    error.status = xhr.status;
    error.response = xhr.responseJSON || xhr.responseText;
    return error;
  }
};

api.upload = {
  postFormData: function(formData, callback) {
    var uri = '/v1/device/upload?&timezone=0';
    api.log('POST ' + uri + ' (multipart/form-data)');
    $.ajax({
      url: uri,
      type: 'POST',
      headers: {
        'x-tidepool-session-token': api.token
      },
      data: formData,
      contentType: false,
      processData: false
    })
    .done(function(data, textStatus, xhr) {
      if (typeof callback === 'function') {
        callback(null, data);
      }
    })
    .fail(function(xhr) {
      api._handleFailedRequest(xhr, callback);
    });
  }
};

api.syncTask = {
  get: function(id, callback) {
    var uri = '/v1/synctasks/' + id;
    api.log('GET ' + uri);
    api._get(uri, callback);
  }
};

module.exports = api;
