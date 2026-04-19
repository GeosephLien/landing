(function () {
  const SYSTEM_DEFAULTS = {
    apiBase: 'https://ac2-host-api-avatar-page.kuanyi-lien.workers.dev',
    ac2Origin: 'https://geosephlien.github.io',
    ac2Url: 'https://geosephlien.github.io/ac2/?embedded=1&uiMode=modal',
    locale: 'zh-TW',
    storageTenantKey: 'ac2-landing-tenant'
  };

  const createButton = document.getElementById('create-for-free-button');
  const userPill = document.getElementById('landing-user-pill');
  const userPillText = document.getElementById('landing-user-pill-text');
  const ac2Modal = document.getElementById('ac2-modal');
  const ac2Frame = document.getElementById('ac2-frame');
  const verificationModal = document.getElementById('verification-modal');
  const verificationWorkflow = document.getElementById('verification-workflow');
  const verificationEmailInput = document.getElementById('verification-email-input');
  const verificationCodeInput = document.getElementById('verification-code-input');
  const verificationStatus = document.getElementById('verification-status');
  const verificationProgress = document.getElementById('verification-progress');
  const verificationProgressBar = document.getElementById('verification-progress-bar');
  const verificationProgressText = document.getElementById('verification-progress-text');
  const verificationProgressDetail = document.getElementById('verification-progress-detail');
  const verificationResendButton = document.getElementById('verification-resend-button');
  const verificationDownloadButton = document.getElementById('verification-download-button');
  const downloadCompletePanel = document.getElementById('download-complete-panel');
  const downloadCompleteStatus = document.getElementById('download-complete-status');
  const downloadCompletePlayButton = document.getElementById('download-complete-play-button');
  const verificationCloseTargets = Array.from(document.querySelectorAll('[data-close-verification]'));

  const state = {
    tenantId: '',
    draftTenantId: '',
    authenticatedTenantKey: '',
    ac2Ready: false,
    ac2RequestId: '',
    activeAc2Mode: 'draft',
    draftSessionToken: '',
    authenticatedSessionToken: '',
    finalSessionToken: '',
    claimInFlight: false,
    claimPromise: null,
    claimError: '',
    lastClaimedTenantId: '',
    launchPending: false,
    resumeToCreator: false,
    pendingAvatarKey: '',
    pendingFileName: 'avatar.vrm',
    pendingVrmBlob: null,
    downloadRequestId: '',
    verifiedForDownload: false,
    authenticationPassed: false,
    verifiedCodeValue: '',
    uploadStarted: false,
    uploadReady: false,
    verificationPanelMode: 'verify',
    verifyingCode: false,
    sendingCode: false,
    downloading: false,
    currentUserEmail: ''
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

  function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    const precision = size >= 100 || unitIndex === 0 ? 0 : 1;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
  }

  function setVerificationProgress(percent, detail, options) {
    const nextOptions = options || {};
    const clampedPercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const isVisible = !nextOptions.hidden;

    if (verificationProgress) {
      verificationProgress.hidden = !isVisible;
      verificationProgress.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    }

    if (verificationProgressBar) {
      verificationProgressBar.style.width = `${clampedPercent}%`;
    }

    if (verificationProgressText) {
      verificationProgressText.textContent = `${clampedPercent}%`;
    }

    if (verificationProgressDetail) {
      verificationProgressDetail.textContent = detail || 'Waiting to download...';
    }
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function renderUserPill(email) {
    const normalized = normalizeEmail(email);
    state.currentUserEmail = normalized;

    if (!userPill || !userPillText) {
      return;
    }

    if (!normalized) {
      userPill.hidden = true;
      userPillText.textContent = 'Hi,';
      return;
    }

    userPillText.textContent = `Hi, ${normalized}`;
    userPill.hidden = false;
  }

  function hasAuthenticatedUser() {
    return Boolean(normalizeEmail(state.currentUserEmail || state.tenantId));
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

  function setVerificationPanelMode(mode) {
    state.verificationPanelMode = mode === 'complete' ? 'complete' : 'verify';

    if (verificationWorkflow) {
      verificationWorkflow.hidden = state.verificationPanelMode !== 'verify';
    }

    if (downloadCompletePanel) {
      downloadCompletePanel.hidden = state.verificationPanelMode !== 'complete';
    }
  }

  function setDownloadCompleteState(message, options) {
    const nextOptions = options || {};
    if (downloadCompleteStatus) {
      downloadCompleteStatus.textContent = message || 'Download complete. Play your avatar when ready.';
      downloadCompleteStatus.classList.toggle('is-error', nextOptions.tone === 'error');
      downloadCompleteStatus.classList.toggle('is-success', nextOptions.tone !== 'error');
    }

    if (downloadCompletePlayButton) {
      downloadCompletePlayButton.disabled = state.claimInFlight;
      downloadCompletePlayButton.textContent = state.claimInFlight ? 'Preparing Avatar...' : 'Play Avatar';
    }
  }

  function showDownloadCompletePanel(message, options) {
    setVerificationPanelMode('complete');
    setVerificationProgress(0, 'Waiting to download...', { hidden: true });
    setDownloadCompleteState(message, options);
  }

  function getDemoSceneUrl() {
    const tenant = state.lastClaimedTenantId || state.tenantId;
    return `https://geosephlien.github.io/demo/demo-scene/?tenant=${encodeURIComponent(tenant)}`;
  }

  function navigateToDemoScene() {
    window.location.href = getDemoSceneUrl();
  }

  function queueClaimDraftAvatar() {
    if (state.claimPromise) {
      return state.claimPromise;
    }

    state.claimInFlight = true;
    state.claimError = '';
    setDownloadCompleteState('Finalizing your avatar for play...', { tone: 'success' });

    state.claimPromise = claimDraftAvatar()
      .then((claim) => {
        state.finalSessionToken = claim.sessionToken || state.finalSessionToken;
        state.pendingAvatarKey = claim.claimedKey || state.pendingAvatarKey;
        state.pendingFileName = claim.fileName || state.pendingFileName;
        state.tenantId = normalizeEmail(claim.tenantId || state.tenantId);
        state.lastClaimedTenantId = state.tenantId;
        persistTenant(state.tenantId);
        renderUserPill(state.tenantId);
        return claim;
      })
        .catch((error) => {
          state.claimError = error && error.message ? error.message : 'Failed to finalize avatar ownership.';
          throw error;
        })
      .finally(() => {
        state.claimInFlight = false;
        const message = state.claimError || 'Download complete. Play your avatar when ready.';
        setDownloadCompleteState(message, { tone: state.claimError ? 'error' : 'success' });
        if (state.claimError) {
          state.claimPromise = null;
        }
      });

    return state.claimPromise;
  }

  function updateVerificationStatusForState() {
    if (state.verificationPanelMode !== 'verify') {
      return;
    }

    if (state.downloading || state.verifyingCode) {
      return;
    }

    if (state.authenticationPassed && state.uploadReady) {
      setStatus(verificationStatus, 'Authentication already completed. Download is ready.', 'success');
      return;
    }

    if (state.verifiedForDownload && state.uploadReady) {
      setStatus(verificationStatus, 'Avatar ready. Download is now enabled.', 'success');
      return;
    }

    if (state.verifiedForDownload && !state.uploadReady) {
      setStatus(verificationStatus, 'Email verified. Your avatar is still uploading. Download will be enabled once it is ready.');
      return;
    }

    if (state.uploadStarted && !state.uploadReady) {
      setStatus(verificationStatus, 'Your avatar is uploading. You can complete email verification while we prepare the VRM.');
      return;
    }

    if (state.uploadReady && !state.verifiedForDownload) {
      setStatus(verificationStatus, 'Avatar upload complete. Finish email verification to enable download.');
      return;
    }

    setStatus(verificationStatus, 'Enter your email, send the verification code, then download the VRM.');
  }

  function syncVerificationButtons() {
    const normalizedCode = verificationCodeInput
      ? verificationCodeInput.value.replace(/\D+/g, '').slice(0, 4)
      : '';
    const canDownload = state.authenticationPassed
      ? state.uploadReady && state.pendingAvatarKey && state.pendingVrmBlob instanceof Blob
      : state.verifiedForDownload && state.uploadReady && state.pendingAvatarKey && state.pendingVrmBlob instanceof Blob;

    if (verificationResendButton) {
      verificationResendButton.disabled = state.sendingCode || state.downloading || state.verifyingCode;
      verificationResendButton.textContent = state.sendingCode
        ? 'Sending...'
        : (state.downloadRequestId ? 'Resend Code' : 'Send Code');
    }

    if (verificationDownloadButton) {
      verificationDownloadButton.disabled = !canDownload || state.downloading || state.verifyingCode;
      verificationDownloadButton.textContent = state.downloading
        ? 'Downloading...'
        : (state.verifyingCode ? 'Verifying...' : 'Download VRM');
    }

    if (downloadCompletePlayButton) {
      downloadCompletePlayButton.disabled = state.claimInFlight;
      downloadCompletePlayButton.textContent = state.claimInFlight ? 'Preparing Avatar...' : 'Play Avatar';
    }
  }

  function openVerificationModal(options) {
    const nextOptions = options || {};
    toggleModal(verificationModal, true);
    setVerificationPanelMode('verify');

    if (nextOptions.resetForm) {
      state.downloadRequestId = '';
      if (!state.authenticationPassed) {
        state.verifiedForDownload = false;
        state.verifiedCodeValue = '';
      }

      if (verificationEmailInput && !state.authenticationPassed) {
        verificationEmailInput.value = '';
      }
      if (verificationCodeInput && !state.authenticationPassed) {
        verificationCodeInput.value = '';
        verificationCodeInput.classList.remove('input-error');
      }
    }

    setVerificationProgress(0, 'Waiting to download...', { hidden: true });
    updateVerificationStatusForState();
    syncVerificationButtons();
    window.setTimeout(() => {
      if (nextOptions.focusField && verificationEmailInput) {
        verificationEmailInput.focus();
      }
    }, 0);
  }

  function closeVerificationModal() {
    toggleModal(verificationModal, false);
    setStatus(verificationStatus, '');
    setVerificationProgress(0, 'Waiting to download...', { hidden: true });
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

  async function requestAuthenticatedSession(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Enter a valid email address first.');
    }

    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/session`, {
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
    if (!response.ok || !payload || !payload.sessionToken) {
      throw new Error(payload && payload.message ? payload.message : 'Failed to create an authenticated AC2 session.');
    }

    return payload;
  }

  async function fetchCurrentUser() {
    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/me`, {
      method: 'GET',
      credentials: 'include'
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) {
      throw new Error(payload && payload.message ? payload.message : 'Unable to restore the current user.');
    }

    return payload;
  }

  async function bootstrapCurrentUser() {
    try {
      const payload = await fetchCurrentUser();
      const restoredEmail = normalizeEmail(payload && payload.email);
      if (restoredEmail) {
        state.tenantId = restoredEmail;
        state.authenticatedTenantKey = payload && payload.tenantId ? String(payload.tenantId) : '';
        persistTenant(restoredEmail);
        renderUserPill(restoredEmail);
        return;
      }
    } catch (error) {
      console.debug('No persisted landing user session.', error);
    }

    renderUserPill('');
  }

  async function requestDownloadCode(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Enter a valid email address first.');
    }

    state.tenantId = normalizedEmail;
    persistTenant(normalizedEmail);
    state.sendingCode = true;
    state.downloadRequestId = '';
    state.verifiedForDownload = false;
    state.verifiedCodeValue = '';
    if (verificationCodeInput) {
      verificationCodeInput.classList.remove('input-error');
    }
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
      setStatus(verificationStatus, `Verification code sent to ${normalizedEmail}. Enter the 4-digit code to continue.`, 'success');
    } finally {
      state.sendingCode = false;
      syncVerificationButtons();
    }

    if (verificationCodeInput && verificationCodeInput.value.replace(/\D+/g, '').slice(0, 4).length === 4) {
      handleVerificationCodeInput();
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

  function isFilePickerAbortError(error) {
    return error && (error.name === 'AbortError' || error.message === 'The user aborted a request.');
  }

  async function requestFileHandle(filename) {
    if (typeof window.showSaveFilePicker !== 'function') {
      throw new Error('This browser does not support the file picker required for VRM download.');
    }

    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '.vrm';
    return window.showSaveFilePicker({
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
  }

  async function saveBlobWithFileHandle(blob, handle, onProgress) {
    if (!(blob instanceof Blob)) {
      throw new Error('VRM data is no longer available in memory.');
    }

    const writable = await handle.createWritable();
    const totalBytes = blob.size || 0;
    const stream = typeof blob.stream === 'function' ? blob.stream() : null;

    if (!stream || typeof stream.getReader !== 'function') {
      await writable.write(blob);
      await writable.close();
      if (typeof onProgress === 'function') {
        onProgress({
          loadedBytes: totalBytes,
          totalBytes,
          done: true
        });
      }
      return;
    }

    const reader = stream.getReader();
    let loadedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (value && value.byteLength > 0) {
          await writable.write(value);
          loadedBytes += value.byteLength;
          if (typeof onProgress === 'function') {
            onProgress({
              loadedBytes,
              totalBytes,
              done: false
            });
          }
        }
      }

      await writable.close();
      if (typeof onProgress === 'function') {
        onProgress({
          loadedBytes,
          totalBytes,
          done: true
        });
      }
    } catch (error) {
      try {
        await writable.abort();
      } catch (abortError) {
        console.warn('Unable to abort partially written file.', abortError);
      }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  function buildInitPayload() {
    if (state.activeAc2Mode === 'viewer') {
      return {
        tenantId: state.authenticatedTenantKey || state.currentUserEmail || state.tenantId,
        sessionToken: state.authenticatedSessionToken,
        apiBase: SYSTEM_DEFAULTS.apiBase,
        uiMode: 'modal',
        locale: SYSTEM_DEFAULTS.locale,
        autoStart: false,
        contentMode: 'viewer',
        frameStyle: FRAME_STYLE
      };
    }

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
    const sessionToken = state.activeAc2Mode === 'viewer'
      ? state.authenticatedSessionToken
      : state.draftSessionToken;

    if (!state.ac2Ready || !sessionToken || !ac2Frame || !ac2Frame.contentWindow) {
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
      state.activeAc2Mode = 'draft';
      state.draftTenantId = session.draftTenantId || '';
      state.draftSessionToken = session.sessionToken || '';
      state.ac2RequestId = `landing-host-${Date.now()}`;
      state.launchPending = true;
      state.pendingAvatarKey = '';
      state.pendingFileName = 'avatar.vrm';
      state.pendingVrmBlob = null;
      state.claimInFlight = false;
      state.claimPromise = null;
      state.claimError = '';
      state.uploadStarted = false;
      state.uploadReady = false;
      state.verifiedForDownload = state.authenticationPassed;
      state.verifiedCodeValue = state.authenticationPassed ? state.verifiedCodeValue : '';
      setVerificationPanelMode('verify');
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

  async function launchAuthenticatedViewer() {
    if (createButton) {
      createButton.disabled = true;
    }

    try {
      const session = await requestAuthenticatedSession(state.currentUserEmail || state.tenantId);
      state.activeAc2Mode = 'viewer';
      state.authenticatedSessionToken = session.sessionToken || '';
      state.authenticatedTenantKey = session.tenantId || state.authenticatedTenantKey;
      state.ac2RequestId = `landing-viewer-${Date.now()}`;
      state.launchPending = true;
      state.resumeToCreator = false;
      openAc2Modal();

      if (ac2Frame.getAttribute('src') !== SYSTEM_DEFAULTS.ac2Url) {
        ac2Frame.setAttribute('src', SYSTEM_DEFAULTS.ac2Url);
      } else if (state.ac2Ready) {
        sendInit();
      }
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Unable to launch AC2 viewer.');
    } finally {
      if (createButton) {
        createButton.disabled = false;
      }
    }
  }

  async function handleVerificationCodeInput() {
    if (!verificationCodeInput) {
      return;
    }

    const code = verificationCodeInput.value.replace(/\D+/g, '').slice(0, 4);
    verificationCodeInput.value = code;
    state.verifiedForDownload = false;
    state.verifiedCodeValue = '';
    verificationCodeInput.classList.remove('input-error');
    syncVerificationButtons();

    if (code.length < 4) {
      updateVerificationStatusForState();
      return;
    }

    if (!state.downloadRequestId) {
      setStatus(verificationStatus, 'Send the verification code to your email first.');
      return;
    }

    state.verifyingCode = true;
    syncVerificationButtons();
    setStatus(verificationStatus, 'Verifying code...');

    try {
      await verifyDownloadCode(code);
      state.authenticationPassed = true;
      state.verifiedForDownload = true;
      state.verifiedCodeValue = code;
      renderUserPill(state.tenantId);
      verificationCodeInput.classList.remove('input-error');
      updateVerificationStatusForState();
    } catch (error) {
      console.error(error);
      verificationCodeInput.classList.add('input-error');
      setStatus(verificationStatus, error.message || 'Verification failed.', 'error');
    } finally {
      state.verifyingCode = false;
      syncVerificationButtons();
    }
  }

  async function handleDownload() {
    if (!state.pendingAvatarKey || state.downloading || !verificationCodeInput) {
      return;
    }

    const code = verificationCodeInput.value.replace(/\D+/g, '').slice(0, 4);
    verificationCodeInput.value = code;

    if (code.length < 4) {
      setStatus(verificationStatus, 'Enter the 4-digit verification code.', 'error');
      syncVerificationButtons();
      return;
    }

    if (!state.downloadRequestId) {
      setStatus(verificationStatus, 'Send the verification code to your email first.', 'error');
      return;
    }

    if (!state.authenticationPassed && (!state.verifiedForDownload || state.verifiedCodeValue !== code)) {
      setStatus(verificationStatus, 'Finish email verification to enable download.', 'error');
      return;
    }

    if (!state.uploadReady) {
      setStatus(verificationStatus, 'Your avatar is still uploading. Download will be enabled when it is ready.');
      return;
    }

    let fileHandle = null;
    try {
      fileHandle = await requestFileHandle(state.pendingFileName || 'avatar.vrm');
    } catch (error) {
      if (isFilePickerAbortError(error)) {
        return;
      }
      setStatus(verificationStatus, error.message || 'Unable to open the file picker.', 'error');
      return;
    }

    state.downloading = true;
    syncVerificationButtons();
    setStatus(verificationStatus, 'Preparing download...');
    setVerificationProgress(0, 'Preparing download...', { hidden: false });

    try {
      if (!(state.pendingVrmBlob instanceof Blob)) {
        throw new Error('VRM data is no longer available on the landing page. Please create it again.');
      }

      const claimPromise = queueClaimDraftAvatar();

      try {
        await saveBlobWithFileHandle(state.pendingVrmBlob, fileHandle, ({ loadedBytes, totalBytes, done }) => {
          const hasTotal = Number.isFinite(totalBytes) && totalBytes > 0;
          const percent = hasTotal
            ? Math.round((loadedBytes / totalBytes) * 100)
            : (done ? 100 : 0);
          const detail = hasTotal
            ? `${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)}`
            : `${formatBytes(loadedBytes)} downloaded`;

          setVerificationProgress(percent, detail, { hidden: false });
          setStatus(
            verificationStatus,
            done ? 'Download complete.' : 'Downloading VRM to your device...'
          );
        });
      } catch (error) {
        if (isFilePickerAbortError(error)) {
          setVerificationProgress(0, 'Download was cancelled.', { hidden: true });
          setStatus(verificationStatus, 'Download was cancelled. You can try again.', 'error');
          return;
        }
        throw error;
      }

      state.authenticationPassed = true;
      state.verifiedForDownload = true;
      setStatus(verificationStatus, 'Download complete.', 'success');
      setVerificationProgress(100, 'Saved to your selected location.', { hidden: false });
      state.resumeToCreator = false;
      showDownloadCompletePanel('Download complete. Play your avatar when ready.', { tone: 'success' });
      claimPromise.catch((error) => {
        console.error(error);
      });
    } catch (error) {
      console.error(error);
      setVerificationProgress(0, error.message || 'VRM download failed.', { hidden: true });
      setStatus(verificationStatus, error.message || 'VRM download failed.', 'error');
    } finally {
      state.downloading = false;
      syncVerificationButtons();
    }
  }

  function reopenCreator() {
    openAc2Modal();
    if (state.ac2Ready) {
      sendInit();
      if (state.activeAc2Mode === 'draft') {
        requestCreatorStart();
      }
    }
  }

  function handleCreateButtonClick() {
    if (state.resumeToCreator && ac2Frame.getAttribute('src')) {
      reopenCreator();
      return;
    }

    if (hasAuthenticatedUser()) {
      launchAuthenticatedViewer();
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
      if (state.activeAc2Mode === 'draft') {
        requestCreatorStart();
      }
      return;
    }

    if (message.type === 'ac2:upload-started') {
      if (state.activeAc2Mode === 'viewer') {
        return;
      }
      state.uploadStarted = true;
      state.uploadReady = false;
      state.pendingVrmBlob = null;
      if (!state.authenticationPassed) {
        openVerificationModal({
          resetForm: true,
          focusField: true
        });
      }
      return;
    }

    if (message.type === 'ac2:upload-progress') {
      if (state.activeAc2Mode === 'viewer') {
        return;
      }
      state.uploadStarted = true;
      if (!verificationModal.hidden) {
        updateVerificationStatusForState();
      }
      return;
    }

    if (message.type === 'ac2:upload-complete') {
      if (state.activeAc2Mode === 'viewer') {
        state.resumeToCreator = false;
        return;
      }
      state.uploadStarted = true;
      state.uploadReady = true;
      state.pendingAvatarKey = message.payload && message.payload.key ? message.payload.key : '';
      state.pendingFileName = message.payload && message.payload.fileName ? message.payload.fileName : 'avatar.vrm';
      state.pendingVrmBlob = message.payload && message.payload.fileBlob instanceof Blob
        ? message.payload.fileBlob
        : null;
      state.resumeToCreator = false;
      if (verificationModal.hidden) {
        openVerificationModal({
          resetForm: !state.authenticationPassed,
          focusField: !state.authenticationPassed
        });
        if (!(state.pendingVrmBlob instanceof Blob)) {
          setStatus(verificationStatus, 'VRM data was not retained on the landing page. Please create the avatar again.', 'error');
          syncVerificationButtons();
        } else if (state.authenticationPassed) {
          setStatus(verificationStatus, 'Authentication already completed. Click Download VRM to choose a save location.', 'success');
        }
      } else {
        if (!(state.pendingVrmBlob instanceof Blob)) {
          setStatus(verificationStatus, 'VRM data was not retained on the landing page. Please create the avatar again.', 'error');
        } else {
          updateVerificationStatusForState();
        }
        syncVerificationButtons();
      }
      return;
    }

    if (message.type === 'ac2:close-request') {
      state.resumeToCreator = true;
      closeAc2Modal();
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

  if (downloadCompletePlayButton) {
    downloadCompletePlayButton.addEventListener('click', async () => {
      try {
        await queueClaimDraftAvatar();
        closeVerificationModal();
        closeAc2Modal();
        navigateToDemoScene();
      } catch (error) {
        console.error(error);
        setDownloadCompleteState(error.message || 'Failed to prepare avatar for play.', { tone: 'error' });
      }
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
  }

  bootstrapCurrentUser();
})();
