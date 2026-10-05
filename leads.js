/* Cornerstone site — lead form submission.
   Sends each form to two destinations, each independently toggled from the
   REAI CRM Settings page:
     - Netlify Forms (captures + emails info@cornerhousing.com)  -> website_lead_email
     - REAI CRM (creates a seller lead)                           -> website_lead_to_crm
   Defaults to BOTH on; if the config can't be reached, it still captures. */

var REAI_ENDPOINT = 'https://reai-crm.onrender.com';
var _leadCfg = null;

function _leadEnc(d) {
  return Object.keys(d).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(d[k] == null ? '' : d[k]);
  }).join('&');
}

function _leadCfgGet() {
  if (_leadCfg) return Promise.resolve(_leadCfg);
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, 5000);
  return fetch(REAI_ENDPOINT + '/api/website/config', { signal: ctrl.signal })
    .then(function (r) { return r.json(); })
    .then(function (c) { _leadCfg = c; return c; })
    .catch(function () { _leadCfg = { website_lead_to_crm: true, website_lead_email: true }; return _leadCfg; })
    .finally(function () { clearTimeout(t); });
}

/* Collect fields, send to the enabled destinations, resolve when done. */
function sendLead(form, formName) {
  var fd = new FormData(form);
  var f = {};
  fd.forEach(function (v, k) { if (k !== 'bot-field' && k !== 'form-name') f[k] = v; });

  return _leadCfgGet().then(function (cfg) {
    var tasks = [];

    // 1) Netlify Forms — capture + email
    if (cfg.website_lead_email) {
      var payload = Object.assign({ 'form-name': formName }, f);
      tasks.push(fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: _leadEnc(payload)
      }).catch(function () {}));
    }

    // 2) REAI CRM — create seller lead
    if (cfg.website_lead_to_crm) {
      var name = [f.first_name, f.last_name].filter(Boolean).join(' ').trim() || f.name || '';
      var addr = f.property_address || [f.address, f.city, f.state].filter(Boolean).join(', ');
      tasks.push(fetch(REAI_ENDPOINT + '/api/website-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          phone: f.phone || '',
          email: f.email || '',
          property_address: addr,
          message: f.message || f.subject || '',
          source: 'Website - ' + formName
        })
      }).catch(function () {}));
    }

    return Promise.allSettled(tasks);
  });
}
