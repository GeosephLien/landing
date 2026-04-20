(function () {
  const SYSTEM_DEFAULTS = {
    apiBase: 'https://ac2-host-api-avatar-page.kuanyi-lien.workers.dev',
    ac2Origin: 'https://geosephlien.github.io',
    ac2Url: 'https://geosephlien.github.io/ac2/?embedded=1&uiMode=modal',
    locale: 'zh-TW',
    storageTenantKey: 'ac2-landing-tenant'
  };

  const createButton = document.getElementById('create-for-free-button');
  const pageShell = document.querySelector('.page');
  const heroShell = document.querySelector('.hero-shell');
  const userPill = document.getElementById('landing-user-pill');
  const userPillText = document.getElementById('landing-user-pill-text');
  const forgetMeButton = document.getElementById('landing-forget-me-button');
  const embeddedScene = document.getElementById('embedded-demo-scene');
  const landingSceneCanvas = document.getElementById('landing-scene-canvas');
  const landingSceneSessionStatus = document.getElementById('landing-scene-session-status');
  const landingSceneAvatarStatus = document.getElementById('landing-scene-avatar-status');
  const landingSceneOpenAc2Button = document.getElementById('landing-scene-open-ac2-button');
  const landingSceneBackButton = document.getElementById('landing-scene-back-button');
  const ac2Modal = document.getElementById('ac2-modal');
  const ac2Frame = document.getElementById('ac2-frame');
  const verificationModal = document.getElementById('verification-modal');
  const verificationWorkflow = document.getElementById('verification-workflow');
  const verificationTitle = document.getElementById('verification-title');
  const verificationStepEmail = document.getElementById('verification-step-email');
  const verificationStepCode = document.getElementById('verification-step-code');
  const verificationResendRow = document.getElementById('verification-resend-row');
  const verificationEmailInput = document.getElementById('verification-email-input');
  const verificationCodeInput = document.getElementById('verification-code-input');
  const verificationStatus = document.getElementById('verification-status');
  const verificationProgress = document.getElementById('verification-progress');
  const verificationProgressBar = document.getElementById('verification-progress-bar');
  const verificationProgressText = document.getElementById('verification-progress-text');
  const verificationProgressDetail = document.getElementById('verification-progress-detail');
  const verificationSendActions = document.getElementById('verification-send-actions');
  const verificationSendButton = document.getElementById('verification-send-button');
  const verificationResendButton = document.getElementById('verification-resend-button');
  const verificationDownloadButton = document.getElementById('verification-download-button');
  const downloadCompletePanel = document.getElementById('download-complete-panel');
  const downloadCompleteDownloadButton = document.getElementById('download-complete-download-button');
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
    authenticatedSessionEmail: '',
    finalSessionToken: '',
    claimInFlight: false,
    claimPromise: null,
    claimError: '',
    claimErrorCode: '',
    lastClaimedTenantId: '',
    launchPending: false,
    resumeToCreator: false,
    pendingAvatarKey: '',
    pendingFileName: 'avatar.vrm',
    pendingVrmBlob: null,
    pendingAccountEmail: '',
    downloadRequestId: '',
    verifiedForDownload: false,
    authenticationPassed: false,
    verifiedCodeValue: '',
    uploadStarted: false,
    uploadReady: false,
    verificationPanelMode: 'verify',
    verificationStep: 'email',
    verifyingCode: false,
    sendingCode: false,
    downloading: false,
    downloadCompletedOnce: false,
    currentUserEmail: '',
    forgettingUser: false
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

  const VRM_SCENE_MODULE_URL = new URL('../demo/demo-scene/vrm-scene.js', window.location.href).href;
  let vrmSceneModulePromise = null;
  let embeddedVrmScene = null;
  let embeddedSceneInitPromise = null;
  let embeddedSceneLoadedTenant = '';

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

  function getSyncedTenantEmail() {
    return normalizeEmail(state.currentUserEmail || state.lastClaimedTenantId || state.tenantId);
  }

  function hasDraftAvatarReady() {
    return Boolean(state.draftSessionToken && state.draftTenantId && state.pendingAvatarKey);
  }

  function shouldShowDraftSaveAction() {
    return hasDraftAvatarReady() && !hasAuthenticatedUser();
  }

  function syncPrimaryActionButton() {
    if (!createButton) {
      return;
    }

    createButton.textContent = hasAuthenticatedUser() ? 'Play It' : 'Create for Free!';
  }

  function renderUserPill(email) {
    const normalized = normalizeEmail(email);
    state.currentUserEmail = normalized;

    if (!userPill || !userPillText) {
      return;
    }

    if (normalized) {
      userPillText.textContent = `Hi, ${normalized}`;
      userPill.hidden = false;
      if (forgetMeButton) {
        forgetMeButton.textContent = 'Forget me';
        forgetMeButton.disabled = state.forgettingUser;
      }
      syncPrimaryActionButton();
      return;
    }

    if (shouldShowDraftSaveAction()) {
      userPill.hidden = false;
      userPillText.textContent = 'Playing as guest';
      if (forgetMeButton) {
        forgetMeButton.textContent = 'Create account to save your avatar';
        forgetMeButton.disabled = state.sendingCode || state.verifyingCode || state.claimInFlight;
      }
      syncPrimaryActionButton();
      return;
    }

    userPill.hidden = true;
    userPillText.textContent = 'Hi,';
    if (forgetMeButton) {
      forgetMeButton.textContent = 'Forget me';
      forgetMeButton.disabled = false;
    }
    syncPrimaryActionButton();
  }

  function hasAuthenticatedUser() {
    return Boolean(getSyncedTenantEmail());
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

  function clearPersistedTenant() {
    try {
      window.localStorage.removeItem(SYSTEM_DEFAULTS.storageTenantKey);
    } catch (error) {
      console.warn('Unable to clear tenant email.', error);
    }
  }

  function resetAuthenticatedLandingState() {
    state.tenantId = '';
    state.authenticatedTenantKey = '';
    state.authenticatedSessionToken = '';
    state.authenticatedSessionEmail = '';
    state.finalSessionToken = '';
    state.currentUserEmail = '';
    state.activeAc2Mode = 'draft';
    state.resumeToCreator = false;
    state.authenticationPassed = false;
    state.verifiedForDownload = false;
    state.verifiedCodeValue = '';
    state.pendingAccountEmail = '';
    clearPersistedTenant();
    renderUserPill('');
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

  function setVerificationStep(step) {
    state.verificationStep = step === 'code' ? 'code' : 'email';

    if (verificationStepEmail) {
      verificationStepEmail.hidden = state.verificationStep !== 'email';
    }

    if (verificationStepCode) {
      verificationStepCode.hidden = state.verificationStep !== 'code';
    }

    if (verificationResendRow) {
      verificationResendRow.hidden = state.verificationStep !== 'code';
    }

    if (verificationSendActions) {
      verificationSendActions.hidden = state.verificationStep !== 'email';
    }

    if (verificationProgress && state.verificationStep === 'email') {
      verificationProgress.hidden = true;
      verificationProgress.setAttribute('aria-hidden', 'true');
    }

    if (verificationDownloadButton) {
      const actions = verificationDownloadButton.closest('.flow-actions');
      if (actions) {
        actions.hidden = state.verificationStep === 'email';
      }
    }
  }

  function setVerificationPanelMode(mode) {
    state.verificationPanelMode = mode === 'ready' ? 'ready' : 'verify';

    if (verificationTitle) {
      verificationTitle.textContent = state.verificationPanelMode === 'ready'
        ? 'Avatar Ready'
        : 'Create Account to Save Avatar';
    }

    if (verificationWorkflow) {
      verificationWorkflow.hidden = state.verificationPanelMode !== 'verify';
    }

    if (downloadCompletePanel) {
      downloadCompletePanel.hidden = state.verificationPanelMode !== 'ready';
    }
  }

  function setDownloadCompleteState(message, options) {
    if (downloadCompleteDownloadButton) {
      downloadCompleteDownloadButton.disabled = state.downloading;
      downloadCompleteDownloadButton.textContent = state.downloading
        ? 'Downloading...'
        : (state.downloadCompletedOnce ? 'Download VRM Again' : 'Download VRM');
      downloadCompleteDownloadButton.classList.toggle('is-secondary-look', state.downloadCompletedOnce);
    }

    if (downloadCompletePlayButton) {
      downloadCompletePlayButton.disabled = state.claimInFlight;
      downloadCompletePlayButton.textContent = state.claimInFlight ? 'Preparing Avatar...' : 'Play It';
      downloadCompletePlayButton.classList.toggle('is-primary-look', state.downloadCompletedOnce);
    }

    if (forgetMeButton && shouldShowDraftSaveAction()) {
      forgetMeButton.disabled = state.sendingCode || state.downloading || state.verifyingCode || state.claimInFlight;
    }
  }

  function showDownloadCompletePanel(message, options) {
    setVerificationPanelMode('ready');
    setVerificationProgress(0, 'Waiting to download...', { hidden: true });
    setDownloadCompleteState(message, options);
  }

  function openDownloadReadyModal(message, options) {
    toggleModal(verificationModal, true);
    showDownloadCompletePanel(message, options);
    setStatus(verificationStatus, message || '', options && options.tone ? options.tone : 'success');
  }

  function setSceneSessionText(value) {
    if (landingSceneSessionStatus) {
      landingSceneSessionStatus.textContent = value;
    }
  }

  async function ensureSceneSession() {
    const syncedTenantEmail = getSyncedTenantEmail();
    if (syncedTenantEmail && isValidEmail(syncedTenantEmail)) {
      if (!state.authenticatedSessionToken || state.authenticatedSessionEmail !== syncedTenantEmail) {
        setSceneSessionText('Requesting authenticated session...');
        const session = await requestAuthenticatedSession(syncedTenantEmail);
        state.authenticatedSessionToken = session.sessionToken || '';
        state.authenticatedTenantKey = session.tenantId || state.authenticatedTenantKey;
        state.authenticatedSessionEmail = syncedTenantEmail;
      }

      setSceneSessionText(`Session ready for ${syncedTenantEmail}`);
      return {
        mode: 'claimed',
        tenantId: syncedTenantEmail,
        sessionToken: state.authenticatedSessionToken
      };
    }

    if (!hasDraftAvatarReady()) {
      throw new Error('Create an avatar first before opening the embedded scene.');
    }

    setSceneSessionText(`Draft session ready for ${state.draftTenantId}`);
    return {
      mode: 'draft',
      tenantId: state.draftTenantId,
      sessionToken: state.draftSessionToken
    };
  }

  async function authorizedGet(path) {
    const session = await ensureSceneSession();
    return fetch(`${SYSTEM_DEFAULTS.apiBase}${path}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${session.sessionToken}`
      }
    });
  }

  async function fetchVrmFiles() {
    const response = await authorizedGet('/api/ac2/files');
    if (!response.ok) {
      throw new Error(`Failed to fetch VRM files (${response.status})`);
    }
    return response.json();
  }

  async function fetchDownloadUrl(key, expiresIn = 3600) {
    const response = await authorizedGet(
      `/api/ac2/download-url?key=${encodeURIComponent(key)}&expiresIn=${encodeURIComponent(expiresIn)}`
    );
    if (!response.ok) {
      throw new Error(`Failed to create download URL (${response.status})`);
    }
    return response.json();
  }

  async function fetchAnimationUrl(name, expiresIn = 3600) {
    const response = await authorizedGet(
      `/api/ac2/animation-url?name=${encodeURIComponent(name)}&expiresIn=${encodeURIComponent(expiresIn)}`
    );
    if (!response.ok) {
      throw new Error(`Failed to create animation URL (${response.status})`);
    }
    return response.json();
  }

  async function fetchActiveAvatar() {
    const response = await authorizedGet('/api/ac2/active-avatar');
    if (!response.ok) {
      return null;
    }
    const payload = await response.json().catch(() => null);
    return payload && payload.key ? payload.key : null;
  }

  async function saveActiveAvatar(key) {
    const session = await ensureSceneSession();
    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/active-avatar`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.sessionToken}`
      },
      body: JSON.stringify({ key })
    });

    if (!response.ok) {
      throw new Error(`Failed to save active avatar (${response.status})`);
    }
  }

  async function ensureEmbeddedSceneReady() {
    if (embeddedVrmScene) {
      return embeddedVrmScene;
    }

    if (embeddedSceneInitPromise) {
      return embeddedSceneInitPromise;
    }

    embeddedSceneInitPromise = (async () => {
      if (!landingSceneCanvas) {
        throw new Error('Embedded scene canvas is not available.');
      }

      setSceneSessionText('Loading scene module...');
      if (!vrmSceneModulePromise) {
        vrmSceneModulePromise = import(VRM_SCENE_MODULE_URL);
      }

      const sceneModule = await vrmSceneModulePromise;
      embeddedVrmScene = sceneModule.createVrmScene({
        canvas: landingSceneCanvas,
        avatarStatus: landingSceneAvatarStatus
      });

      embeddedVrmScene.start({
        resolveAnimationUrl: (name) => fetchAnimationUrl(name),
        resolveDownloadUrl: (key) => fetchDownloadUrl(key)
      });

      return embeddedVrmScene;
    })().finally(() => {
      embeddedSceneInitPromise = null;
    });

    return embeddedSceneInitPromise;
  }

  async function loadEmbeddedSceneAvatar(options = {}) {
    const nextOptions = options || {};
    const session = await ensureSceneSession();
    const nextSceneTenant = session.mode === 'claimed' ? getSyncedTenantEmail() : state.draftTenantId;
    const sceneInstance = await ensureEmbeddedSceneReady();

    if (!nextOptions.force && embeddedSceneLoadedTenant === nextSceneTenant) {
      setSceneSessionText(session.mode === 'claimed'
        ? `Session ready for ${nextSceneTenant}`
        : `Draft session ready for ${nextSceneTenant}`);
      return sceneInstance;
    }

    setSceneSessionText(session.mode === 'claimed'
      ? `Loading avatar for ${nextSceneTenant}...`
      : `Loading draft avatar ${nextSceneTenant}...`);
    await sceneInstance.loadInitialAvatar(
      () => fetchVrmFiles(),
      () => fetchActiveAvatar(),
      (key) => fetchDownloadUrl(key)
    );
    embeddedSceneLoadedTenant = nextSceneTenant;
    setSceneSessionText(session.mode === 'claimed'
      ? `Session ready for ${nextSceneTenant}`
      : `Draft session ready for ${nextSceneTenant}`);
    return sceneInstance;
  }

  async function showEmbeddedDemoScene() {
    renderUserPill(getSyncedTenantEmail());
    if (embeddedScene) {
      embeddedScene.hidden = false;
    }
    if (heroShell) {
      heroShell.hidden = true;
    }

    try {
      await loadEmbeddedSceneAvatar({ force: !embeddedSceneLoadedTenant });
    } catch (error) {
      console.error(error);
      setSceneSessionText(error.message || 'Unable to load the embedded scene.');
      if (landingSceneAvatarStatus) {
        landingSceneAvatarStatus.textContent = `Unable to load avatar: ${error.message}`;
      }
    }
  }

  function hideEmbeddedDemoScene() {
    if (embeddedScene) {
      embeddedScene.hidden = true;
    }
    if (heroShell) {
      heroShell.hidden = false;
    }
  }

  function getClaimFailureMessage(error) {
    if (error && error.code === 'AVATAR_LIMIT_REACHED') {
      return "Your avatar was downloaded, but it couldn't be added to your account because you've reached the 6-avatar limit. You can still play with your existing avatars.";
    }

    return error && error.message
      ? error.message
      : 'Failed to finalize avatar ownership.';
  }

  function queueClaimDraftAvatar() {
    if (state.claimPromise) {
      return state.claimPromise;
    }

    state.claimInFlight = true;
    state.claimError = '';
    state.claimErrorCode = '';
    setDownloadCompleteState('Finalizing your avatar for play...', { tone: 'success' });

    state.claimPromise = claimDraftAvatar()
      .then((claim) => {
        state.finalSessionToken = claim.sessionToken || state.finalSessionToken;
        state.pendingAvatarKey = claim.claimedKey || state.pendingAvatarKey;
        state.pendingFileName = claim.fileName || state.pendingFileName;
        state.tenantId = normalizeEmail(claim.tenantId || state.pendingAccountEmail || state.tenantId);
        state.lastClaimedTenantId = state.tenantId;
        state.pendingAccountEmail = '';
        persistTenant(state.tenantId);
        renderUserPill(state.tenantId);
        return claim;
      })
        .catch((error) => {
          state.claimErrorCode = error && error.code ? error.code : '';
          state.claimError = getClaimFailureMessage(error);
          throw error;
        })
      .finally(() => {
        state.claimInFlight = false;
        const message = state.claimError || 'Download complete. Play your avatar when ready.';
        setDownloadCompleteState(message, { tone: state.claimError ? 'error' : 'success' });
        renderUserPill(state.currentUserEmail);
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

    if (state.downloading || state.verifyingCode || state.claimInFlight) {
      return;
    }

    if (state.authenticationPassed && state.uploadReady) {
      setStatus(verificationStatus, 'Verification already completed. Save your avatar when ready.', 'success');
      return;
    }

    if (state.verificationStep === 'email') {
      setStatus(verificationStatus, 'Enter your email and send the verification code to save this draft avatar.');
      return;
    }

    if (!state.downloadRequestId) {
      setStatus(verificationStatus, 'Send the verification code to your email first.');
      return;
    }

    if (!state.verifiedForDownload) {
      setStatus(verificationStatus, 'Enter the 4-digit verification code, then click Confirm to save your avatar.');
      return;
    }

    setStatus(verificationStatus, 'Verification passed. Saving your avatar...', 'success');
  }

  function syncVerificationButtons() {
    const normalizedCode = verificationCodeInput
      ? verificationCodeInput.value.replace(/\D+/g, '').slice(0, 4)
      : '';
    const canVerifyAndDownload = Boolean(
      state.downloadRequestId
      && normalizedCode.length === 4
      && state.pendingAvatarKey
      && state.pendingVrmBlob instanceof Blob
    );

    if (verificationSendButton) {
      verificationSendButton.disabled = state.sendingCode || state.downloading || state.verifyingCode || state.claimInFlight;
      verificationSendButton.textContent = state.sendingCode ? 'Sending...' : 'Send Code';
    }

    if (verificationResendButton) {
      verificationResendButton.disabled = state.sendingCode || state.downloading || state.verifyingCode || state.claimInFlight;
      verificationResendButton.textContent = state.sendingCode ? 'Sending...' : 'Resend Code';
    }

    if (verificationDownloadButton) {
      verificationDownloadButton.disabled = !canVerifyAndDownload || state.downloading || state.verifyingCode || state.claimInFlight;
      verificationDownloadButton.textContent = state.claimInFlight
        ? 'Syncing...'
        : (state.verifyingCode ? 'Verifying...' : 'Confirm');
    }

    if (downloadCompleteDownloadButton) {
      downloadCompleteDownloadButton.disabled = state.downloading;
      downloadCompleteDownloadButton.textContent = state.downloading
        ? 'Downloading...'
        : (state.downloadCompletedOnce ? 'Download VRM Again' : 'Download VRM');
      downloadCompleteDownloadButton.classList.toggle('is-secondary-look', state.downloadCompletedOnce);
    }

    if (downloadCompletePlayButton) {
      downloadCompletePlayButton.disabled = state.claimInFlight;
      downloadCompletePlayButton.textContent = state.claimInFlight ? 'Preparing Avatar...' : 'Play It';
      downloadCompletePlayButton.classList.toggle('is-primary-look', state.downloadCompletedOnce);
    }
  }

  function openVerificationModal(options) {
    const nextOptions = options || {};
    toggleModal(verificationModal, true);
    setVerificationPanelMode('verify');

    if (nextOptions.resetForm) {
      state.downloadRequestId = '';
      state.verifiedForDownload = false;
      state.verifiedCodeValue = '';
      state.authenticationPassed = false;
      state.pendingAccountEmail = '';
      setVerificationStep('email');

      if (verificationEmailInput) {
        verificationEmailInput.value = '';
      }
      if (verificationCodeInput) {
        verificationCodeInput.value = '';
        verificationCodeInput.classList.remove('input-error');
      }
    } else if (state.downloadRequestId) {
      setVerificationStep('code');
    } else {
      setVerificationStep('email');
    }

    setVerificationProgress(0, 'Waiting to download...', { hidden: true });
    updateVerificationStatusForState();
    syncVerificationButtons();
    window.setTimeout(() => {
      if (!nextOptions.focusField) {
        return;
      }

      if (state.verificationStep === 'code' && verificationCodeInput) {
        verificationCodeInput.focus();
        return;
      }

      if (verificationEmailInput) {
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

    renderUserPill(getSyncedTenantEmail());
  }

  async function logoutCurrentUser() {
    const response = await fetch(`${SYSTEM_DEFAULTS.apiBase}/api/ac2/logout`, {
      method: 'POST',
      credentials: 'include'
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !payload.ok) {
      throw new Error(payload && payload.message ? payload.message : 'Unable to forget this browser.');
    }

    return payload;
  }

  async function handleForgetMe() {
    if (state.forgettingUser) {
      return;
    }

    state.forgettingUser = true;
    if (forgetMeButton) {
      forgetMeButton.disabled = true;
    }

    try {
      await logoutCurrentUser();
    } catch (error) {
      console.error(error);
      window.alert(error.message || 'Unable to forget this browser.');
      state.forgettingUser = false;
      renderUserPill(state.currentUserEmail);
      return;
    }

    resetAuthenticatedLandingState();
    closeVerificationModal();
    closeAc2Modal();
    state.forgettingUser = false;
    renderUserPill('');
  }

  function handleUserPillAction() {
    if (shouldShowDraftSaveAction()) {
      openVerificationModal({
        resetForm: true,
        focusField: true
      });
      return;
    }

    handleForgetMe();
  }

  async function requestDownloadCode(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      throw new Error('Enter a valid email address first.');
    }

    state.pendingAccountEmail = normalizedEmail;
    state.sendingCode = true;
    state.downloadRequestId = '';
    state.verifiedForDownload = false;
    state.verifiedCodeValue = '';
    state.authenticationPassed = false;
    if (verificationCodeInput) {
      verificationCodeInput.value = '';
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
      setVerificationStep('code');
      setStatus(verificationStatus, `Verification code sent to ${normalizedEmail}. Enter the 4-digit code to continue.`, 'success');
    } finally {
      state.sendingCode = false;
      updateVerificationStatusForState();
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
        tenantId: state.pendingAccountEmail,
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
        targetTenantId: state.pendingAccountEmail,
        hostOrigin: window.location.origin,
        downloadRequestId: state.downloadRequestId,
        avatarKey: state.pendingAvatarKey
      })
    });

    const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.ok) {
      const error = new Error(payload && payload.message ? payload.message : 'Failed to claim the draft avatar.');
      if (payload && payload.code) {
        error.code = payload.code;
      }
      throw error;
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
      state.downloadCompletedOnce = false;
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
      state.authenticatedSessionEmail = normalizeEmail(state.currentUserEmail || state.tenantId);
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
    state.authenticationPassed = false;
    verificationCodeInput.classList.remove('input-error');
    updateVerificationStatusForState();
    syncVerificationButtons();
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

    state.verifyingCode = true;
    syncVerificationButtons();
    setStatus(verificationStatus, 'Verifying code...');

    try {
      await verifyDownloadCode(code);
      state.authenticationPassed = true;
      state.verifiedForDownload = true;
      state.verifiedCodeValue = code;
      verificationCodeInput.classList.remove('input-error');
      setStatus(verificationStatus, 'Verification succeeded. Saving your avatar now. Do not close or refresh the browser.', 'success');
      syncVerificationButtons();
      await queueClaimDraftAvatar();
      embeddedSceneLoadedTenant = '';
      if (embeddedScene && !embeddedScene.hidden) {
        await loadEmbeddedSceneAvatar({ force: true });
      }
      state.resumeToCreator = false;
      setStatus(verificationStatus, 'Your avatar is now saved to your account.', 'success');
      showDownloadCompletePanel('Your avatar is now saved to your account.', { tone: 'success' });
    } catch (error) {
      console.error(error);
      state.authenticationPassed = false;
      state.verifiedForDownload = false;
      state.verifiedCodeValue = '';
      verificationCodeInput.classList.add('input-error');
      setStatus(verificationStatus, error.message || 'Verification failed.', 'error');
      syncVerificationButtons();
      return;
    } finally {
      state.verifyingCode = false;
      syncVerificationButtons();
    }
  }

  async function handleReadyDownload() {
    if (!state.pendingAvatarKey || state.downloading) {
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
    setDownloadCompleteState('Preparing download...', { tone: 'success' });

    try {
      if (!(state.pendingVrmBlob instanceof Blob)) {
        throw new Error('VRM data is no longer available on the landing page. Please create it again.');
      }

      try {
        await saveBlobWithFileHandle(state.pendingVrmBlob, fileHandle);
      } catch (error) {
        if (isFilePickerAbortError(error)) {
          setStatus(verificationStatus, 'Download was cancelled. You can try again.', 'error');
          setDownloadCompleteState('Download was cancelled. You can try again.', { tone: 'error' });
          return;
        }
        throw error;
      }

      state.authenticationPassed = true;
      state.verifiedForDownload = true;
      state.downloadCompletedOnce = true;
      setStatus(verificationStatus, 'Download complete.', 'success');
      setDownloadCompleteState('Download complete. Play it when ready.', { tone: 'success' });
    } catch (error) {
      console.error(error);
      setStatus(verificationStatus, error.message || 'VRM download failed.', 'error');
      setDownloadCompleteState(error.message || 'VRM download failed.', { tone: 'error' });
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
    if (hasAuthenticatedUser()) {
      showEmbeddedDemoScene();
      return;
    }

    if (state.resumeToCreator && ac2Frame.getAttribute('src')) {
      reopenCreator();
      return;
    }

    launchDraftCreator();
  }

  function handleSceneOpenAc2Click() {
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

    if (message.type === 'ac2:avatar-selected') {
      if (state.activeAc2Mode !== 'viewer' || !embeddedVrmScene) {
        return;
      }

      const selection = message.payload || {};
      const nextKey = selection.key || '';
      const nextName = selection.fileName || selection.label || nextKey || 'avatar.vrm';

      embeddedVrmScene.loadAvatarFromSelection(selection, (key) => fetchDownloadUrl(key))
        .then(() => {
          if (nextKey) {
            return saveActiveAvatar(nextKey);
          }
          return null;
        })
        .catch((error) => {
          console.error(error);
          embeddedVrmScene.setAvatarText(`${nextName} failed: ${error.message}`);
        });
      return;
    }

    if (message.type === 'ac2:upload-started') {
      if (state.activeAc2Mode === 'viewer') {
        return;
      }
      state.uploadStarted = true;
      state.uploadReady = false;
      state.pendingVrmBlob = null;
      state.downloadCompletedOnce = false;
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
      state.pendingAccountEmail = '';
      if (!(state.pendingVrmBlob instanceof Blob)) {
        setStatus(verificationStatus, 'VRM data was not retained on the landing page. Please create the avatar again.', 'error');
        syncVerificationButtons();
        return;
      }
      renderUserPill(state.currentUserEmail);
      openDownloadReadyModal('Your draft avatar is ready. Download it now or jump into Play It.', { tone: 'success' });
      syncVerificationButtons();
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

  if (forgetMeButton) {
    forgetMeButton.addEventListener('click', () => {
      handleUserPillAction();
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

  if (verificationSendButton) {
    verificationSendButton.addEventListener('click', () => {
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

  if (downloadCompleteDownloadButton) {
    downloadCompleteDownloadButton.addEventListener('click', () => {
      handleReadyDownload();
    });
  }

  if (downloadCompletePlayButton) {
    downloadCompletePlayButton.addEventListener('click', async () => {
      closeVerificationModal();
      closeAc2Modal();
      showEmbeddedDemoScene();
    });
  }

  if (landingSceneOpenAc2Button) {
    landingSceneOpenAc2Button.addEventListener('click', () => {
      handleSceneOpenAc2Click();
    });
  }

  if (landingSceneBackButton) {
    landingSceneBackButton.addEventListener('click', () => {
      closeAc2Modal();
      hideEmbeddedDemoScene();
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
    renderUserPill(rememberedTenant);
  }

  syncPrimaryActionButton();
  bootstrapCurrentUser();
})();
