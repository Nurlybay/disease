(function (root) {
  'use strict';
  root.PatientChat = { create: function (options) {
    var history = [], active = null, session = null;
    var sessionKey = 'vp.guest-auth.v1.' + options.baseUrl;
    try { session = JSON.parse(localStorage.getItem(sessionKey) || 'null'); } catch (e) {}
    function save(value) { session = value; try { if (value) localStorage.setItem(sessionKey, JSON.stringify(value)); else localStorage.removeItem(sessionKey); } catch (e) {} }
    function request(op, url, data, token, callback) {
      if (op !== active) return;
      var x = new XMLHttpRequest(); op.xhr = x;
      function finish(error, result, status) { if (active === op) callback(error, result, status); }
      try {
        x.open('POST', url, true); x.timeout = 70000;
        x.setRequestHeader('Content-Type', 'application/json');
        x.setRequestHeader('apikey', options.anonKey);
        if (token) x.setRequestHeader('Authorization', 'Bearer ' + token);
        x.onload = function () {
          var d; try { d = JSON.parse(x.responseText); } catch (e) { finish('invalid_response'); return; }
          finish(null, d, x.status);
        };
        x.onerror = function () { finish('connection_failed'); };
        x.ontimeout = function () { finish('provider_timeout'); };
        x.send(JSON.stringify(data));
      } catch (e) { finish('connection_failed'); }
    }
    function guest(op, callback) {
      if (session && session.access_token && session.expires_at > Date.now()/1000 + 60) { callback(null, session.access_token); return; }
      var refresh = session && session.refresh_token;
      request(op, options.baseUrl + (refresh ? '/auth/v1/token?grant_type=refresh_token' : '/auth/v1/signup'), refresh ? { refresh_token: refresh } : {}, null, function (error, data, status) {
        if (error) { callback(error); return; }
        if (status !== 200 && status !== 201) {
          if (refresh && (status === 400 || status === 401) && /refresh_token_not_found|refresh_token_already_used|invalid_grant/.test(data.error_code || data.code || data.error || '')) { save(null); guest(op, callback); return; }
          callback(status === 429 ? 'guest_signup_rate_limit' : data.error_code === 'anonymous_provider_disabled' || data.code === 'anonymous_provider_disabled' ? 'guest_disabled' : 'guest_signin_failed'); return;
        }
        if (!data.access_token || !data.refresh_token || !data.expires_in) { callback('invalid_auth_response'); return; }
        save({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now()/1000 + Number(data.expires_in) });
        callback(null, session.access_token);
      });
    }
    function cancel() { var op = active; active = null; if (op && op.xhr) op.xhr.abort(); options.busy(false); }
    return {
      cancel: cancel,
      reset: function () { cancel(); history = []; },
      record: function (question, answer) { history.push({role:'user',content:question.slice(0,1000)}, {role:'assistant',content:answer.slice(0,1000)}); history=history.slice(-20); },
      send: function (message) {
        if (active) return false;
        var op = {}; active = op; options.busy(true);
        function done(error, answer) {
          if (active !== op) return;
          active = null; options.busy(false);
          if (error) { options.error(error); return; }
          history.push({ role: 'user', content: message }, { role: 'assistant', content: answer.slice(0,1000) }); history=history.slice(-20);
          options.reply(message, answer);
        }
        guest(op, function (error, token) {
          if (error) { done(error); return; }
          request(op, options.baseUrl + '/functions/v1/patient-chat', {caseId:options.caseId, message:message, history:history}, token, function (error, data, status) {
            if (error) { done(error); return; }
            if (status !== 200) {
              if (status === 401) save(null);
              done(data.error || (status === 401 ? 'guest_expired' : status === 404 ? 'function_not_found' : 'http_' + status)); return;
            }
            if (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > 4000 || data.caseId !== options.caseId) { done('invalid_response'); return; }
            done(null, data.reply);
          });
        });
        return true;
      }
    };
  } };
})(window);
