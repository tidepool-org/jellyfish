var url = require('url');

var request = require('request');


module.exports = function (sandcastleHostGetter) {
  function getHost() {
    var hostSpecs = sandcastleHostGetter.get();
    if (hostSpecs.length < 1) {
      return null;
    }
    return url.format(hostSpecs[0]);
  }

  return {
    store: function (data, cb) {
      var host = getHost();
      if (host == null) {
        return cb({ statusCode: 503, message: "Cannot find a sandcastle server" });
      }

      var opts = {
        method: 'POST',
        uri: host + '/uploads/' + data.meta.groupId + '/upload',
        rejectUnauthorized: false,
        qs: { message: 'upload to sandcastle' }
      };

      var req = request.post(opts, function (err, res, body) {
        if (err != null) {
          return cb(err);
        }
        cb(null, JSON.parse(body).body.content);
      });
      var form = req.form();
      if (data.diasend) {
        form.append('diasend', data.diasend,
                    { 'content-type': 'application/vnd.ms-excel', filename: 'diasend.xls' });
        data.diasend.resume();
      }
      if (data.carelink) {
        form.append('carelink', data.carelink,
                    { 'content-type': 'text/plain', filename: 'carelink.csv' });
        data.carelink.resume();
      }
      if (data.dexcom) {
        form.append('dexcom', data.dexcom,
                    { 'content-type': data.dexcom.type, filename: 'dexcom' });
        data.dexcom.resume();
      }
    }
  };
};