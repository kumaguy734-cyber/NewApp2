(function () {
  'use strict';

  /* =====================================================
     Utilities
     ===================================================== */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function logLine(consoleEl, text, type) {
    const line = document.createElement('div');
    line.className = 'log-line' + (type ? ' ' + type : '');
    line.textContent = text;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function clearLog(consoleEl) {
    consoleEl.innerHTML = '';
  }

  const LAYER_META = {
    app: { label: 'アプリ層', value: 'HTTP/1.1 GET /' },
    transport: { label: 'トランスポート層', value: '宛先ポート：80' },
    network: { label: 'ネットワーク層', value: '宛先IP：192.168.10.20' }
  };

  function renderCapsule(containerEl, message, attachedArr) {
    let html =
      '<div class="capsule-layer capsule-data" data-layer="data">' +
      '<span class="capsule-label">データ</span>' +
      '<span class="capsule-content">' + escapeHtml(message || '') + '</span>' +
      '</div>';
    attachedArr.forEach(function (layer) {
      const m = LAYER_META[layer];
      html =
        '<div class="capsule-layer capsule-' + layer + '" data-layer="' + layer + '">' +
        '<span class="capsule-label">' + m.label + '</span>' +
        '<span class="capsule-content">' + m.value + '</span>' +
        html +
        '</div>';
    });
    containerEl.innerHTML = html;
    const outer = containerEl.firstElementChild;
    if (outer) outer.classList.add('wrap-in');
  }

  /* Route track helpers: prefix is 'build' | 'error' | 'trouble' */
  function routeEls(prefix) {
    return {
      track: document.getElementById(prefix + '-route'),
      packet: document.getElementById(prefix + '-packet')
    };
  }

  function resetRoute(prefix) {
    const { track, packet } = routeEls(prefix);
    packet.style.left = '24px';
    packet.classList.remove('error-state');
    track.querySelectorAll('.route-node').forEach(function (n) {
      n.classList.remove('hit', 'fail');
    });
    const eye = document.getElementById(prefix + '-eye');
    if (eye) eye.classList.remove('visible');
  }

  function nodeCenterLeft(track, nodeSelector) {
    const node = track.querySelector(nodeSelector);
    const trackRect = track.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    return (nodeRect.left - trackRect.left) + nodeRect.width / 2 - 9; // 9 = half packet width
  }

  function movePacketTo(prefix, nodeSelector, isFail) {
    const { track, packet } = routeEls(prefix);
    const left = nodeCenterLeft(track, nodeSelector);
    packet.style.left = left + 'px';
    const node = track.querySelector(nodeSelector);
    if (isFail) {
      packet.classList.add('error-state');
      node.classList.add('fail');
    } else {
      node.classList.add('hit');
    }
  }

  /* =====================================================
     Tabs
     ===================================================== */
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabButtons.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.mode-panel').forEach(function (p) {
        p.classList.remove('active');
      });
      document.getElementById('mode-' + btn.dataset.mode).classList.add('active');
    });
  });

  /* =====================================================
     MODE 1: build (sequential encapsulation)
     ===================================================== */
  (function initBuildMode() {
    const layerOrder = ['app', 'transport', 'network'];
    let attached = [];
    let step = 0;

    const stackEl = document.getElementById('build-stack');
    const capsuleEl = document.getElementById('build-capsule');
    const msgInput = document.getElementById('build-message');
    const sendBtn = document.getElementById('build-send');
    const logEl = document.getElementById('build-log');

    function refreshBlocks() {
      stackEl.querySelectorAll('.header-block').forEach(function (btn) {
        const layer = btn.dataset.layer;
        const idx = layerOrder.indexOf(layer);
        const stateEl = btn.querySelector('.layer-state');
        if (attached.indexOf(layer) !== -1) {
          btn.setAttribute('aria-pressed', 'true');
          btn.disabled = true;
          stateEl.textContent = '付与済み';
        } else if (idx === step) {
          btn.setAttribute('aria-pressed', 'false');
          btn.disabled = false;
          stateEl.textContent = 'タップで付与';
        } else {
          btn.setAttribute('aria-pressed', 'false');
          btn.disabled = true;
          stateEl.textContent = '先に上の層から付与';
        }
      });
      sendBtn.disabled = attached.length < layerOrder.length;
    }

    stackEl.querySelectorAll('.header-block').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const layer = btn.dataset.layer;
        if (layerOrder.indexOf(layer) !== step) return;
        attached.push(layer);
        step++;
        renderCapsule(capsuleEl, msgInput.value, attached);
        refreshBlocks();
      });
    });

    msgInput.addEventListener('input', function () {
      renderCapsule(capsuleEl, msgInput.value, attached);
    });

    sendBtn.addEventListener('click', function () {
      if (attached.length < layerOrder.length) return;
      resetRoute('build');
      clearLog(logEl);
      sendBtn.disabled = true;
      logLine(logEl, 'アプリ層: 「' + (msgInput.value || '(無題)') + '」を HTTP/1.1 で準備', '');
      setTimeout(function () {
        movePacketTo('build', '[data-node="router"]', false);
        logLine(logEl, 'ネットワーク層: 宛先IP 192.168.10.20 へルーティング', '');
      }, 500);
      setTimeout(function () {
        movePacketTo('build', '[data-node="server"]', false);
        logLine(logEl, 'トランスポート層: ポート80でWebサーバーに到達', '');
      }, 1500);
      setTimeout(function () {
        logLine(logEl, 'Status: 200 OK（通信成功）', 'ok');
        sendBtn.disabled = false;
      }, 2300);
    });

    renderCapsule(capsuleEl, msgInput.value, attached);
    refreshBlocks();
  })();

  /* =====================================================
     MODE 2: error experiment
     ===================================================== */
  (function initErrorMode() {
    const stackEl = document.getElementById('error-stack');
    const tlsBox = document.getElementById('error-tls');
    const snifferContent = document.getElementById('error-sniffer-content');
    const sendBtn = document.getElementById('error-send');
    const logEl = document.getElementById('error-log');
    const eyeEl = document.getElementById('error-eye');

    const attached = { app: true, transport: true, network: true };

    function refreshBlocks() {
      stackEl.querySelectorAll('.header-block').forEach(function (btn) {
        const layer = btn.dataset.layer;
        const stateEl = btn.querySelector('.layer-state');
        const on = attached[layer];
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        stateEl.textContent = on ? '付与中（クリックで取り外す）' : '未付与（クリックで付与）';
      });
    }

    function updateSniffer() {
      if (tlsBox.checked) {
        snifferContent.textContent = '4a3f9c1e8b02d5f7...（暗号化済みで読めない）';
        snifferContent.className = 'sniffer-content secured';
      } else {
        snifferContent.textContent = '"こんにちは"（GET / HTTP/1.1）― 平文が丸見え';
        snifferContent.className = 'sniffer-content exposed';
      }
    }

    stackEl.querySelectorAll('.header-block').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const layer = btn.dataset.layer;
        attached[layer] = !attached[layer];
        refreshBlocks();
      });
    });

    tlsBox.addEventListener('change', updateSniffer);

    sendBtn.addEventListener('click', function () {
      resetRoute('error');
      clearLog(logEl);
      eyeEl.classList.remove('visible');

      if (!attached.app) {
        logLine(logEl, 'アプリ層エラー：送信するデータの形式が指定されていません', 'err');
        movePacketTo('error', '[data-node="pc"]', true);
        return;
      }
      if (!attached.network) {
        logLine(logEl, 'ネットワーク層エラー：宛先機器が見つかりません（Host unreachable）', 'err');
        movePacketTo('error', '[data-node="pc"]', true);
        return;
      }

      setTimeout(function () {
        movePacketTo('error', '[data-node="router"]', false);
        if (!tlsBox.checked) {
          eyeEl.classList.add('visible');
          logLine(logEl, '警告：暗号化されていないため、経路上のルーターで通信内容が盗聴されました', 'warn');
        }
      }, 500);

      if (!attached.transport) {
        setTimeout(function () {
          movePacketTo('error', '[data-node="server"]', true);
          logLine(logEl, 'トランスポート層エラー：どのアプリに渡すか不明です（Connection refused at port 80）', 'err');
        }, 1400);
        return;
      }

      setTimeout(function () {
        movePacketTo('error', '[data-node="server"]', false);
        logLine(logEl, 'Status: 200 OK（通信成功）', 'ok');
      }, 1400);
    });

    refreshBlocks();
    updateSniffer();
  })();

  /* =====================================================
     MODE 3: troubleshooting
     ===================================================== */
  (function initTroubleMode() {
    const scenarios = [
      {
        log: 'Connection refused at port 80',
        correctLayer: 'transport',
        explanation: 'ポート80への接続が拒否されています。「どのアプリ（サービス）に渡すか」を決めるトランスポート層のポート設定を見直す必要があります。',
        fixLog: 'トランスポート層：ポート番号の設定を80に修正しました'
      },
      {
        log: 'Host unreachable: 192.168.xx.xx',
        correctLayer: 'network',
        explanation: '宛先の機器そのものに到達できていません。宛先IPアドレスを管理するネットワーク層の設定ミスが疑われます。',
        fixLog: 'ネットワーク層：宛先IPアドレスの設定を修正しました'
      },
      {
        log: 'SSL/TLS Handshake failed',
        correctLayer: 'app',
        explanation: 'TLS（暗号化通信の開始手続き）のハンドシェイクに失敗しています。HTTPSの設定を扱うアプリ層の設定を見直す必要があります。',
        fixLog: 'アプリ層：HTTPS（TLS）の設定を修正しました'
      }
    ];

    const logCard = document.getElementById('trouble-log');
    const nextBtn = document.getElementById('trouble-next');
    const optionsWrap = document.getElementById('trouble-options');
    const feedbackEl = document.getElementById('trouble-feedback');
    const fixBtn = document.getElementById('trouble-fix');
    const consoleEl = document.getElementById('trouble-console');

    let current = scenarios[0];
    let answered = false;

    function pickScenario() {
      let next;
      do {
        next = scenarios[Math.floor(Math.random() * scenarios.length)];
      } while (scenarios.length > 1 && next === current);
      current = next;
      logCard.textContent = current.log;
      answered = false;
      feedbackEl.textContent = '';
      feedbackEl.className = 'feedback-box';
      fixBtn.disabled = true;
      optionsWrap.querySelectorAll('.quiz-btn').forEach(function (b) {
        b.disabled = false;
        b.classList.remove('correct', 'incorrect');
      });
      resetRoute('trouble');
      clearLog(consoleEl);
      logLine(consoleEl, current.log, 'err');
    }

    optionsWrap.querySelectorAll('.quiz-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (answered) return;
        answered = true;
        const chosen = btn.dataset.layer;
        const isCorrect = chosen === current.correctLayer;

        optionsWrap.querySelectorAll('.quiz-btn').forEach(function (b) {
          b.disabled = true;
          if (b.dataset.layer === current.correctLayer) b.classList.add('correct');
          else if (b === btn) b.classList.add('incorrect');
        });

        feedbackEl.textContent = current.explanation;
        feedbackEl.className = 'feedback-box ' + (isCorrect ? 'correct' : 'incorrect');
        fixBtn.disabled = false;
      });
    });

    fixBtn.addEventListener('click', function () {
      resetRoute('trouble');
      clearLog(consoleEl);
      logLine(consoleEl, current.log, 'err');
      logLine(consoleEl, current.fixLog, 'warn');
      fixBtn.disabled = true;

      setTimeout(function () {
        movePacketTo('trouble', '[data-node="router"]', false);
      }, 500);
      setTimeout(function () {
        movePacketTo('trouble', '[data-node="server"]', false);
        logLine(consoleEl, 'Status: 200 OK（通信成功）', 'ok');
        fixBtn.disabled = false;
      }, 1400);
    });

    nextBtn.addEventListener('click', pickScenario);

    pickScenario();
  })();
})();
