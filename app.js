(function () {
  const SYSTEM_DEFAULTS = {
    apiBase: 'https://ac2-host-api-avatar-page.kuanyi-lien.workers.dev',
    ac2Origin: 'https://geosephlien.github.io',
    ac2Url: 'https://geosephlien.github.io/ac2/?embedded=1&uiMode=modal',
    locale: 'zh-TW',
    storageTenantKey: 'ac2-landing-tenant'
  };

  const createButton = document.getElementById('create-for-free-button');
  const ac2Modal = document.getElementById('ac2-modal');
  const ac2Frame = document.getElementById('ac2-frame');
  const closeConfirmModal = document.getElementById('close-confirm-modal');
  const closeConfirmContinueButton = document.getElementById('close-confirm-continue-button');
  const closeConfirmLeaveButton = document.getElementById('close-confirm-leave-button');
  const verificationModal = document.getElementById('verification-modal');
  const verificationEmailInput = document.getElementById('verification-email-input');
  const verificationCodeInput = document.getElementById('verification-code-input');
  const verificationStatus = document.getElementById('verification-status');
  const verificationResendButton = document.getElementById('verification-resend-button');
  const verificationDownloadButton = document.getElementById('verification-download-button');
  const verificationCloseTargets = Array.from(document.querySelectorAll('[data-close-verification]'));

  const state = {
    tenantId: '',
    draftTenantId: '',
    ac2Ready: false,
    ac2RequestId: '',
    draftSessionToken: '',
    finalSessionToken: '',
    launchPending: false,
    resumeToCreator: false,
    pendingAvatarKey: '',
    pendingFileName: 'avatar.vrm',
    downloadRequestId: '',
    verifiedForDownload: false,
    verifyingCode: false,
    sendingCode: false,
    downloading: false
  };

  const FRAME_STYLE = {
    source: 'landing-host',
    placement: 'fullscreen',
    breakpoint: 960,
    panelWidth: 1280,
    panelHeight: 780,
    panelRadius: 0,
    mobilePanelWidth: null,
    mobilePanelHeight: 780,
    mobilePanelRadius: 0,
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    mobilePadding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0
    },
    backdrop: 'rgba(3, 6, 18, 0.82)',
    backdropFilter: 'blur(20px)',
    panelBackground: '#050814',
    frameBackground: '#050814',
    border: '0 solid transparent'
  };

  function setStatus(element, message, tone) {
    if (!element) {
      return;
    }

    element.textContent = message || '';
    element.classList.toggle('is-error', tone === 'error');
    element.classList.toggle('is-success', tone === 'success');
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
  }

  function persistTenant(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return;
    }

    try {
      window.localStorage.setItem(SYSTEM_DEFAULTS.storageTenantKey, normalized);
    } catch (error) {
      console.warn('Unable to persist tenant email.', error);
    }
  }

  function restoreTenant() {
    try {
      return normalizeEmail(window.localStorage.getItem(SYSTEM_DEFAULTS.storageTenantKey) || '');
    } catch (error) {
      console.warn('Unable to restore tenant email.', error);
      return '';
    }
  }

  function toggleModal(element, isOpen) {
    if (!element) {
      return;
    }

    element.hidden = !isOpen;
    if (element.hasAttribute('aria-hidden')) {
      element.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    }
  }

  function openAc2Modal() {
    toggleModal(ac2Modal, true);
  }

  function closeAc2Modal() {
    toggleModal(ac2Modal, false);
  }

  function openCloseConfirm() {
    toggleModal(closeConfirmModal, true);
  }

  function closeCloseConfirm() {
    toggleModal(closeConfirmModal, false);
  }

  function syncVerificationButtons() {
    if (verificationResendButton) {
      verificationResendButton.disabled = state.sendingCode || state.downloading;
      verificationResendButton.textContent = state.sendingCode
        ? 'Sending...'
        : (state.downloadRequestId ? 'Resend Code' : 'Send Code');
    }

    if (verificationDownloadButton) {
      verificationDownloadButton.disabled = !state.verifiedForDownload || state.downloading || !state.pendingAvatarKey;
      verificationDownloadButton.textContent = state.downloading ? 'Downloading...' : 'Download VRM';
    }
  }

  function openVerificationModal() {
    toggleModal(verificationModal, true);
    state.verifiedForDownload = false;
    state.downloadRequestId = '';

    if (verificationEmailInput) {
      verificationEmailInput.value = state.tenantId || restoreTenant();
    }
    if (verificationCodeInput) {
      verificationCodeInput.value = '';
      verificationCodeInput.classList.remove('input-error');
    }

    setStatus(verificationStatus, 'Enter your email, send the verification code, then download the VRM.');
    syncVerificationButtons();
    window.setTimeout(() => {
      if (verificationEmailInput) {
        verificationEmailInput.focus();
      }
    }, 0);
  }

  function closeVerificationModal() {
    toggleModal(verificationModal, false);
    setStatus(verificationStatus, '');
  }

  async function requestDraftSession() {
    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/draft-session`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        hostOrigin: window.location.origin,
        flow: 'landing-create'
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) {
      throw new Error(payload && payload.message ? payload.message : 'Failed to create draft session.');
    }

    return payload;
  }

  async function requestDownloadCode(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Enter a valid email address first.');
    }

    state.tenantId = normalizedEmail;
    persistTenant(normalizedEmail);
    state.sendingCode = true;
    state.verifiedForDownload = false;
    syncVerificationButtons();
    setStatus(verificationStatus, 'Sending verification code...');

    try {
      const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/request-download-code`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tenantId: normalizedEmail,
          hostOrigin: window.location.origin
        })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && payload.message ? payload.message : 'Failed to send verification code.');
      }

      state.downloadRequestId = payload.requestId || '';
      setStatus(verificationStatus, `Verification code sent to ${normalizedEmail}.`, 'success');
    } finally {
      state.sendingCode = false;
      syncVerificationButtons();
    }
  }

  async function verifyDownloadCode(code) {
    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/verify-download-code`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestId: state.downloadRequestId,
        tenantId: state.tenantId,
        hostOrigin: window.location.origin,
        code
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) {
      throw new Error(payload && payload.message ? payload.message : 'Verification failed.');
    }

    return payload;
  }

  async function claimDraftAvatar() {
    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/claim-draft`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.draftSessionToken}`
      },
      body: JSON.stringify({
        targetTenantId: state.tenantId,
        hostOrigin: window.location.origin,
        downloadRequestId: state.downloadRequestId,
        avatarKey: state.pendingAvatarKey
      })
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) {
      throw new Error(payload && payload.message ? payload.message : 'Failed to claim the draft avatar.');
    }

    return payload;
  }

  async function fetchDownloadUrl(key, sessionToken) {
    const response = await fetch(
      `${SYSTEM_DEFAULTS.apiBase}/api/ac2/download-url?key=${encodeURIComponent(key)}&expiresIn=3600`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${sessionToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create download URL (${response.status})`);
    }

    return response.json();
  }

  function isFilePickerAbortError(error) {
    return error && (error.name === 'AbortError' || error.message === 'The user aborted a request.');
  }

  async function saveBlobWithFilePicker(blob, filename) {
    if (typeof window.showSaveFilePicker !== 'function') {
      throw new Error('This browser does not support the file picker required for VRM download.');
    }

    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.vrm';
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'VRM avatar',
          accept: {
            'model/vrm': [extension]
          }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  function buildInitPayload() {
    return {
      tenantId: state.draftTenantId,
      sessionToken: state.draftSessionToken,
      apiBase: SYSTEM_DEFAULTS.apiBase,
      uiMode: 'modal',
      locale: SYSTEM_DEFAULTS.locale,
      autoStart: true,
      contentMode: 'landing',
      frameStyle: FRAME_STYLE
    };
  }

  function sendInit() {
    if (!state.ac2Ready || !state.draftSessionToken || !ac2Frame || !ac2Frame.contentWindow) {
      return;
    }

    ac2Frame.contentWindow.postMessage({
      type: 'ac2:init',
      requestId: state.ac2RequestId,
      payload: buildInitPayload()
    }, SYSTEM_DEFAULTS.ac2Origin);
  }

  function requestCreatorStart() {
    if (!ac2Frame || !ac2Frame.contentWindow) {
      return;
    }

    ac2Frame.contentWindow.postMessage({
      type: 'ac2:start',
      requestId: state.ac2RequestId,
      payload: {}
    }, SYSTEM_DEFAULTS.ac2Origin);
  }

  async function launchDraftCreator() {
    if (createButton) {
      createButton.disabled = true;
    }

    try {
      const session = await requestDraftSession();
      state.draftTenantId = session.draftTenantId || '';
      state.draftSessionToken = session.sessionToken || '';
      state.ac2RequestId = `landing-host-${Date.now()}`;
      state.launchPending = true;
      state.pendingAvatarKey = '';
      state.pendingFileName = 'avatar.vrm';
      openAc2Modal();

      if (ac2Frame.getAttribute('src') !== SYSTEM_DEFAULTS.ac2Url) {
        ac2Frame.setAttribute('src', SYSTEM_DEFAULTS.ac2Url);
      } else if (state.ac2Ready) {
        sendInit();
        requestCreatorStart();
      }
    } catch (error) {
      console.error(error);
      setStatus(verificationStatus, '');
      window.alert(error.message || 'Unable to launch AC2.');
    } finally {
      if (createButton) {
        createButton.disabled = false;
      }
    }
  }

  async function handleVerificationCodeInput() {
    if (!verificationCodeInput || !state.downloadRequestId || state.verifyingCode) {
      return;
    }

    const code = verificationCodeInput.value.replace(/\D+/g, '').slice(0, 4);
    verificationCodeInput.value = code;
    state.verifiedForDownload = false;
    verificationCodeInput.classList.remove('input-error');
    syncVerificationButtons();

    if (code.length < 4) {
      setStatus(verificationStatus, 'Enter the 4-digit verification code.');
      return;
    }

    state.verifyingCode = true;
    setStatus(verificationStatus, 'Verifying code...');

    try {
      await verifyDownloadCode(code);
      state.verifiedForDownload = true;
      setStatus(verificationStatus, 'Code verified. Download is now enabled.', 'success');
    } catch (error) {
      verificationCodeInput.classList.add('input-error');
      setStatus(verificationStatus, error.message || 'Verification failed.', 'error');
    } finally {
      state.verifyingCode = false;
      syncVerificationButtons();
    }
  }

  async function handleDownload() {
    if (!state.pendingAvatarKey || !state.verifiedForDownload || state.downloading) {
      return;
    }

    state.downloading = true;
    syncVerificationButtons();
    setStatus(verificationStatus, 'Claiming your draft avatar...');

    try {
      const claim = await claimDraftAvatar();
      state.finalSessionToken = claim.sessionToken || '';
      state.pendingAvatarKey = claim.claimedKey || state.pendingAvatarKey;
      state.pendingFileName = claim.fileName || state.pendingFileName;
      state.tenantId = normalizeEmail(claim.tenantId || state.tenantId);

      const signed = await fetchDownloadUrl(state.pendingAvatarKey, state.finalSessionToken);
      const response = await fetch(signed.url, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Failed to fetch VRM file (${response.status})`);
      }

      const blob = await response.blob();
      try {
        await saveBlobWithFilePicker(blob, state.pendingFileName || 'avatar.vrm');
      } catch (error) {
        if (isFilePickerAbortError(error)) {
          setStatus(verificationStatus, 'Download was cancelled. You can try again.', 'error');
          return;
        }
        throw error;
      }

      setStatus(verificationStatus, 'Download complete. Opening the demo scene...', 'success');
      state.resumeToCreator = false;
      closeAc2Modal();
      const nextUrl = `https://geosephlien.github.io/demo/demo-scene/?tenant=${encodeURIComponent(state.tenantId)}`;
      window.setTimeout(() => {
        window.location.href = nextUrl;
      }, 350);
    } catch (error) {
      console.error(error);
      setStatus(verificationStatus, error.message || 'VRM download failed.', 'error');
    } finally {
      state.downloading = false;
      syncVerificationButtons();
    }
  }

  function reopenCreator() {
    closeCloseConfirm();
    openAc2Modal();
    if (state.ac2Ready) {
      sendInit();
      requestCreatorStart();
    }
  }

  function handleCreateButtonClick() {
    if (state.resumeToCreator && state.draftSessionToken && ac2Frame.getAttribute('src')) {
      reopenCreator();
      return;
    }

    launchDraftCreator();
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== SYSTEM_DEFAULTS.ac2Origin) {
      return;
    }

    const message = event.data || {};
    if (!message.type) {
      return;
    }

    if (message.type === 'ac2:ready') {
      state.ac2Ready = true;
      if (state.launchPending) {
        sendInit();
      }
      return;
    }

    if (message.type === 'ac2:init-ack') {
      state.launchPending = false;
      requestCreatorStart();
      return;
    }

    if (message.type === 'ac2:upload-complete') {
      state.pendingAvatarKey = message.payload && message.payload.key ? message.payload.key : '';
      state.pendingFileName = message.payload && message.payload.fileName ? message.payload.fileName : 'avatar.vrm';
      state.resumeToCreator = false;
      closeAc2Modal();
      closeCloseConfirm();
      openVerificationModal();
      return;
    }

    if (message.type === 'ac2:close-request') {
      state.resumeToCreator = true;
      openCloseConfirm();
      return;
    }

    if (message.type === 'ac2:error' || message.type === 'ac2:blocked' || message.type === 'ac2:upload-failed') {
      const detail = message.payload && (message.payload.message || message.payload.detail)
        ? `${message.payload.message || ''} ${message.payload.detail || ''}`.trim()
        : 'AC2 reported an error.';
      setStatus(verificationStatus, detail, 'error');
    }
  });

  if (createButton) {
    createButton.addEventListener('click', handleCreateButtonClick);
  }

  if (closeConfirmContinueButton) {
    closeConfirmContinueButton.addEventListener('click', () => {
      closeCloseConfirm();
    });
  }

  if (closeConfirmLeaveButton) {
    closeConfirmLeaveButton.addEventListener('click', () => {
      closeCloseConfirm();
      closeAc2Modal();
    });
  }

  if (verificationEmailInput) {
    verificationEmailInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        requestDownloadCode(verificationEmailInput.value).catch((error) => {
          setStatus(verificationStatus, error.message || 'Failed to send verification code.', 'error');
        });
      }
    });
  }

  if (verificationCodeInput) {
    verificationCodeInput.addEventListener('input', () => {
      handleVerificationCodeInput();
    });
  }

  if (verificationResendButton) {
    verificationResendButton.addEventListener('click', () => {
      requestDownloadCode(verificationEmailInput ? verificationEmailInput.value : '').catch((error) => {
        setStatus(verificationStatus, error.message || 'Failed to send verification code.', 'error');
      });
    });
  }

  if (verificationDownloadButton) {
    verificationDownloadButton.addEventListener('click', () => {
      handleDownload();
    });
  }

  verificationCloseTargets.forEach((target) => {
    target.addEventListener('click', () => {
      closeVerificationModal();
    });
  });

  const rememberedTenant = restoreTenant();
  if (rememberedTenant) {
    state.tenantId = rememberedTenant;
    if (verificationEmailInput) {
      verificationEmailInput.value = rememberedTenant;
    }
  }
})();
