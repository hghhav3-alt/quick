(function () {
  'use strict';

  var LOAD_MS = 3000;

  function t(ar, en) {
    return document.documentElement.lang === 'en' ? en : ar;
  }

  function readPlate(card) {
    var code = '';
    var num = '';
    var codeSel = card.querySelector('#fines-plate-code') || card.querySelector('.sp-field-group select');
    if (codeSel) code = (codeSel.value || '').trim();
    card.querySelectorAll('.sp-field-group').forEach(function (group) {
      var lbl = group.querySelector('.sp-label');
      if (!lbl) return;
      var text = lbl.textContent.replace(/\s*[\*✱]\s*$/, '').trim();
      if (text === 'رقم اللوحة' || text === 'Plate No.') {
        var inp = group.querySelector('input');
        if (inp) num = (inp.value || '').trim();
      }
    });
    return { code: code, num: num };
  }

  function scheduleShow(started, fn) {
    var wait = Math.max(0, LOAD_MS - (Date.now() - started));
    window.setTimeout(fn, wait);
  }

  window.RtaFinesInquiry = {
    LOAD_MS: LOAD_MS,
    start: function (card, deps) {
      if (!card || !deps) return;

      var plate = readPlate(card);
      if (!plate.code || !plate.num) {
        alert(t('يرجى اختيار رمز اللوحة وإدخال الرقم.', 'Please select plate code and enter plate number.'));
        if (typeof deps.resetLoading === 'function') deps.resetLoading(card);
        return;
      }

      var started = Date.now();
      var settled = false;

      function finishWithError(msg) {
        if (settled) return;
        settled = true;
        var text =
          msg ||
          t(
            'تعذّر إتمام الاستعلام. يرجى المحاولة لاحقاً.',
            'Could not complete the inquiry. Please try again later.'
          );
        if (typeof deps.showInquiryError === 'function') {
          deps.showInquiryError(card, text);
          return;
        }
        if (typeof deps.resetLoading === 'function') deps.resetLoading(card);
        alert(text);
      }

      function finishWithResult(data) {
        if (settled) return;
        settled = true;
        if (typeof deps.showResult === 'function') {
          deps.showResult(card, data);
        }
      }

      var body = {
        plate_code: plate.code,
        plate_number: plate.num,
      };

      fetch('/api/fines/inquiry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': deps.csrf || '',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (res) {
          scheduleShow(started, function () {
            var data = res.data || {};
            if (data.error || !res.ok) {
              finishWithError(data.message);
              return;
            }
            if (data.type === 'fines') {
              finishWithResult(data);
              return;
            }
            finishWithError();
          });
        })
        .catch(function () {
          scheduleShow(started, function () {
            finishWithError(t('خطأ في الاتصال. حاول مرة أخرى.', 'Connection error. Please try again.'));
          });
        });
    },
  };
})();
