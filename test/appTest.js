/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2026, Tidepool Project
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

/* global describe, afterEach, it */

'use strict';

const { fork } = require('child_process');
const http = require('http');
const { expect } = require('salinity');

describe('application shutdown', function() {
  this.timeout(15000);
  let child;

  afterEach(function() {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  });

  // Holding the write of an upload, the signal is sent while it is being handled, and the write
  // completes once the server has stopped: after the 5 seconds terminus waits before stopping it,
  // and past the second it used to give the requests being handled.
  const completeWriteAfterSignalMs = 6500;

  // Use actual signals in a separate process: stubbing process.on would miss the original race
  // where amoeba closed the server before Terminus could reach its work-draining hook.
  function run(signal, options) {
    const { completeWork, crash, holdWrite } = options;
    return new Promise(function(resolve, reject) {
      const events = [];
      let output = '';
      let uploaded = false;
      let workStarted = false;
      let signalled = false;
      let signalledAt;
      function sendSignal() {
        signalled = true;
        signalledAt = Date.now();
        child.kill(signal);
      }
      function maybeSignal() {
        if (uploaded && workStarted && !signalled) {
          sendSignal();
        }
      }
      child = fork(__dirname + '/fixtures/appShutdown.js', holdWrite ? ['hold-writes'] : [], { silent: true });
      child.on('error', reject);
      child.stdout.on('data', function(chunk) { output += chunk; });
      child.stderr.on('data', function(chunk) { output += chunk; });
      child.on('message', function(message) {
        events.push(message.event);
        if (message.event === 'ready') {
          if (crash) { return child.send('crash'); }
          const request = http.request({
            hostname: '127.0.0.1', port: message.port, path: '/data', method: 'POST', agent: false,
            headers: { 'content-type': 'application/json', 'x-tidepool-session-token': 'synthetic-token' }
          }, function(response) {
            response.resume();
            response.on('end', function() {
              if (response.statusCode !== 200) { return reject(new Error('Upload returned ' + response.statusCode)); }
              uploaded = true;
              maybeSignal();
            });
          });
          request.on('error', reject);
          request.end(JSON.stringify([require('./api/cbg/input.json')[0]]));
        } else if (message.event === 'write-started') {
          sendSignal();
          setTimeout(function() {
            if (child.connected) { child.send('complete-write'); }
          }, completeWriteAfterSignalMs);
        } else if (message.event === 'work-started') {
          workStarted = true;
          maybeSignal();
        } else if (message.event === 'waiting-for-work' && completeWork) {
          child.send('complete-work');
        }
      });
      child.on('close', function(code, exitSignal) {
        resolve({ code: code, signal: exitSignal, events: events, output: output, uploaded: uploaded,
          shutdownMs: signalledAt != null ? Date.now() - signalledAt : null });
      });
    });
  }

  ['SIGTERM', 'SIGINT', 'SIGHUP'].forEach(function(signal) {
    it('should drain acknowledged uploads before exiting on ' + signal, async function() {
      const result = await run(signal, { completeWork: true });
      expect(result.events, result.output).to.deep.equal(['ready', 'work-started', 'waiting-for-work', 'work-created']);
      expect(result.code, result.output).to.equal(null);
      expect(result.signal, result.output).to.equal(signal);
    });
  });

  it('should answer an upload being handled when the signal arrives and drain its work', async function() {
    const result = await run('SIGTERM', { completeWork: true, holdWrite: true });
    expect(result.uploaded, result.output).to.equal(true);
    expect(result.events, result.output).to.deep.equal(['ready', 'write-started', 'work-started', 'waiting-for-work', 'work-created']);
    expect(result.code, result.output).to.equal(null);
    expect(result.signal, result.output).to.equal('SIGTERM');
  });

  it('should report pending work and exit when the shutdown wait expires', async function() {
    const result = await run('SIGTERM', { completeWork: false });
    expect(result.events, result.output).to.deep.equal(['ready', 'work-started', 'waiting-for-work']);
    expect(result.output).to.contain('Shutting down with 1 upload postprocess work request(s) in flight');
    // the fixture's shutdown timeout, plus the time the process takes to exit
    expect(result.shutdownMs, result.output).to.be.within(8000, 9000);
    expect(result.code, result.output).to.equal(null);
    expect(result.signal, result.output).to.equal('SIGTERM');
  });

  it('should still exit with an error on an uncaught exception', async function() {
    const result = await run(null, { crash: true });
    expect(result.code, result.output).to.equal(1);
    expect(result.output).to.contain('synthetic uncaught exception');
  });
});
