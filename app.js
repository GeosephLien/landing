(function () {
  const SYSTEM_DEFAULTS = {
    apiBase: 'https://ac2-host-api-avatar-page.kuanyi-lien.workers.dev',
    ac2Origin: 'https://geosephlien.github.io',
    ac2Url: 'https://geosephlien.github.io/ac2/?embedded=1&uiMode=modal',
    locale: 'zh-TW',
    storageTenantKey: 'ac2-landing-tenant'
  };

  const createButton = document.getElementById('create-for-free-button');
  const enterDemoSceneButton = document.getElementById('enter-demo-scene-button');
  const getSdkButton = document.getElementById('get-sdk-button');
  const pageShell = document.querySelector('.page');
  const heroShell = document.querySelector('.hero-shell');
  const userPill = document.getElementById('landing-user-pill');
  const userPillText = document.getElementById('landing-user-pill-text');
  const forgetMeButton = document.getElementById('landing-forget-me-button');
  const landingPillOpenAc2Button = document.getElementById('landing-pill-open-ac2-button');
  const landingPillCreateAvatarButton = document.getElementById('landing-pill-create-avatar-button');
  const landingPillDownloadAvatarButton = document.getElementById('landing-pill-download-avatar-button');
  const landingPillSaveAccountButton = document.getElementById('landing-pill-save-account-button');
  const embeddedScene = document.getElementById('embedded-demo-scene');
  const landingSceneCanvas = document.getElementById('landing-scene-canvas');
  const embeddedSceneBackButton = document.getElementById('embedded-scene-back-button');
  const landingSceneSessionStatus = document.getElementById('landing-scene-session-status');
  const landingSceneAvatarStatus = document.getElementById('landing-scene-avatar-status');
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

    const isGuestWithDraft = shouldShowDraftSaveAction();
    createButton.textContent = hasAuthenticatedUser()
      ? 'Enter Demo Scene'
      : (isGuestWithDraft ? 'Create New Avatar' : 'Create for Free!');

    if (enterDemoSceneButton) {
      enterDemoSceneButton.hidden = !isGuestWithDraft;
    }

    if (getSdkButton) {
      getSdkButton.hidden = isGuestWithDraft;
    }
  }

  function syncSceneActionButtons() {
    const sceneVisible = Boolean(embeddedScene && !embeddedScene.hidden);
    const showGuestDraftActions = shouldShowDraftSaveAction();
    const showGuestSaveAction = showGuestDraftActions;
    const showGuestCreateAvatarAction = sceneVisible && showGuestDraftActions;
    const showAvatarAccess = hasAuthenticatedUser();
    const showSceneDownloadAction = sceneVisible && (showAvatarAccess || hasDraftAvatarReady());
    const showSceneBackButton = sceneVisible && hasAuthenticatedUser();

    if (landingPillOpenAc2Button) {
      landingPillOpenAc2Button.hidden = !showAvatarAccess;
    }

    if (landingPillCreateAvatarButton) {
      landingPillCreateAvatarButton.hidden = !showGuestCreateAvatarAction;
    }

    if (landingPillDownloadAvatarButton) {
      landingPillDownloadAvatarButton.hidden = !showSceneDownloadAction;
      landingPillDownloadAvatarButton.disabled = state.downloading;
      landingPillDownloadAvatarButton.textContent = state.downloading ? 'Downloading...' : 'Download This Avatar';
    }

    if (embeddedSceneBackButton) {
      embeddedSceneBackButton.hidden = !showSceneBackButton;
    }

    if (landingPillSaveAccountButton) {
      landingPillSaveAccountButton.hidden = !showGuestSaveAction;
      landingPillSaveAccountButton.disabled = state.sendingCode || state.downloading || state.verifyingCode || state.claimInFlight;
    }

    if (forgetMeButton) {
      forgetMeButton.hidden = !hasAuthenticatedUser();
    }
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
      syncSceneActionButtons();
      return;
    }

    if (shouldShowDraftSaveAction()) {
      userPill.hidden = false;
      userPillText.textContent = "You're in Guest Mode";
      if (forgetMeButton) {
        forgetMeButton.textContent = 'Forget me';
        forgetMeButton.disabled = false;
      }
      syncPrimaryActionButton();
      syncSceneActionButtons();
      return;
    }

    userPill.hidden = true;
    userPillText.textContent = 'Hi,';
    if (forgetMeButton) {
      forgetMeButton.textContent = 'Forget me';
      forgetMeButton.disabled = false;
    }
    syncPrimaryActionButton();
    syncSceneActionButtons();
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

    if (element === verificationModal && embeddedVrmScene && typeof embeddedVrmScene.setInteractionEnabled === 'function') {
      embeddedVrmScene.setInteractionEnabled(!isOpen);
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
        : (state.downloadCompletedOnce ? 'Download Avatar ZIP Again' : 'Download Avatar ZIP');
      downloadCompleteDownloadButton.classList.toggle('is-secondary-look', state.downloadCompletedOnce);
    }

    if (downloadCompletePlayButton) {
      downloadCompletePlayButton.disabled = state.claimInFlight;
      downloadCompletePlayButton.textContent = state.claimInFlight ? 'Preparing Avatar...' : 'Try Playing Your Avatar';
      downloadCompletePlayButton.classList.toggle('is-primary-look', state.downloadCompletedOnce);
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
    syncSceneActionButtons();

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
    syncSceneActionButtons();
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
        : (state.downloadCompletedOnce ? 'Download Avatar ZIP Again' : 'Download Avatar ZIP');
      downloadCompleteDownloadButton.classList.toggle('is-secondary-look', state.downloadCompletedOnce);
    }

    if (downloadCompletePlayButton) {
      downloadCompletePlayButton.disabled = state.claimInFlight;
      downloadCompletePlayButton.textContent = state.claimInFlight ? 'Preparing Avatar...' : 'Try Playing Your Avatar';
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
    window.location.reload();
  }

  function handleUserPillAction() {
    handleForgetMe();
  }

  function openSaveAccountFlow() {
    openVerificationModal({
      resetForm: true,
      focusField: true
    });
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

  async function requestArchiveFileHandle(filename) {
    if (typeof window.showSaveFilePicker !== 'function') {
      throw new Error('This browser does not support the file picker required for ZIP download.');
    }

    return window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'ZIP archive',
          accept: {
            'application/zip': ['.zip']
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

  const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }

    return table;
  })();

  let avatarThumbnailModulePromise = null;

  function computeCrc32(bytes) {
    let crc = 0xffffffff;

    for (let index = 0; index < bytes.length; index += 1) {
      crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  function createDosDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    return {
      time: ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f),
      date: (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f)
    };
  }

  async function toUint8Array(value) {
    if (value instanceof Uint8Array) {
      return value;
    }

    if (value instanceof Blob) {
      return new Uint8Array(await value.arrayBuffer());
    }

    if (typeof value === 'string') {
      return new TextEncoder().encode(value);
    }

    throw new Error('Unsupported zip content type.');
  }

  function writeUint16(view, offset, value) {
    view.setUint16(offset, value & 0xffff, true);
  }

  function writeUint32(view, offset, value) {
    view.setUint32(offset, value >>> 0, true);
  }

  async function fetchAsset(path, responseType = 'text') {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path} (${response.status}).`);
    }

    if (responseType === 'blob') {
      return response.blob();
    }

    return response.text();
  }

  async function buildZipBlob(entries) {
    const normalizedEntries = await Promise.all(entries.map(async (entry) => {
      const nameBytes = new TextEncoder().encode(entry.path);
      const dataBytes = await toUint8Array(entry.content);
      return {
        nameBytes,
        dataBytes,
        crc32: computeCrc32(dataBytes)
      };
    }));

    const parts = [];
    const centralDirectoryParts = [];
    let localOffset = 0;
    const { time, date } = createDosDateTime();

    normalizedEntries.forEach((entry) => {
      const localHeader = new ArrayBuffer(30);
      const localView = new DataView(localHeader);
      writeUint32(localView, 0, 0x04034b50);
      writeUint16(localView, 4, 20);
      writeUint16(localView, 6, 0);
      writeUint16(localView, 8, 0);
      writeUint16(localView, 10, time);
      writeUint16(localView, 12, date);
      writeUint32(localView, 14, entry.crc32);
      writeUint32(localView, 18, entry.dataBytes.length);
      writeUint32(localView, 22, entry.dataBytes.length);
      writeUint16(localView, 26, entry.nameBytes.length);
      writeUint16(localView, 28, 0);
      parts.push(localHeader, entry.nameBytes, entry.dataBytes);

      const centralHeader = new ArrayBuffer(46);
      const centralView = new DataView(centralHeader);
      writeUint32(centralView, 0, 0x02014b50);
      writeUint16(centralView, 4, 20);
      writeUint16(centralView, 6, 20);
      writeUint16(centralView, 8, 0);
      writeUint16(centralView, 10, 0);
      writeUint16(centralView, 12, time);
      writeUint16(centralView, 14, date);
      writeUint32(centralView, 16, entry.crc32);
      writeUint32(centralView, 20, entry.dataBytes.length);
      writeUint32(centralView, 24, entry.dataBytes.length);
      writeUint16(centralView, 28, entry.nameBytes.length);
      writeUint16(centralView, 30, 0);
      writeUint16(centralView, 32, 0);
      writeUint16(centralView, 34, 0);
      writeUint16(centralView, 36, 0);
      writeUint32(centralView, 38, 0);
      writeUint32(centralView, 42, localOffset);
      centralDirectoryParts.push(centralHeader, entry.nameBytes);

      localOffset += 30 + entry.nameBytes.length + entry.dataBytes.length;
    });

    const centralDirectorySize = centralDirectoryParts.reduce((total, part) => total + part.byteLength, 0);
    const endRecord = new ArrayBuffer(22);
    const endView = new DataView(endRecord);
    writeUint32(endView, 0, 0x06054b50);
    writeUint16(endView, 4, 0);
    writeUint16(endView, 6, 0);
    writeUint16(endView, 8, normalizedEntries.length);
    writeUint16(endView, 10, normalizedEntries.length);
    writeUint32(endView, 12, centralDirectorySize);
    writeUint32(endView, 16, localOffset);
    writeUint16(endView, 20, 0);

    return new Blob([...parts, ...centralDirectoryParts, endRecord], {
      type: 'application/zip'
    });
  }

  function renderRuntimeSdkTenantBootstrap() {
    return [
      "const tenantId = (() => {",
      "  const storageKey = 'ac2-demo-tenant-id';",
      "  let stored = '';",
      "  try {",
      "    stored = window.localStorage.getItem(storageKey) || '';",
      "  } catch {}",
      "  if (stored && stored.trim()) {",
      "    return stored.trim();",
      "  }",
      '',
      "  const hostSeed = (window.location.hostname || 'local')",
      "    .replace(/[^a-z0-9-]+/gi, '-')",
      "    .replace(/^-+|-+$/g, '')",
      "    .toLowerCase() || 'local';",
      "  const generated = `demo-${hostSeed}-${Math.random().toString(36).slice(2, 8)}`;",
      "  try {",
      "    window.localStorage.setItem(storageKey, generated);",
      "  } catch {}",
      "  return generated;",
      '})();'
    ].join('\n');
  }

  function renderRuntimeSdkTenantResolver() {
    return [
      "const DEFAULT_TENANT_ID = (() => {",
      "  const storageKey = 'ac2-demo-tenant-id';",
      "  let stored = '';",
      "  try {",
      "    stored = window.localStorage.getItem(storageKey) || '';",
      "  } catch {}",
      "  if (stored && stored.trim()) {",
      "    return stored.trim();",
      "  }",
      '',
      "  const hostSeed = (window.location.hostname || 'local')",
      "    .replace(/[^a-z0-9-]+/gi, '-')",
      "    .replace(/^-+|-+$/g, '')",
      "    .toLowerCase() || 'local';",
      "  const generated = `demo-${hostSeed}-${Math.random().toString(36).slice(2, 8)}`;",
      "  try {",
      "    window.localStorage.setItem(storageKey, generated);",
      "  } catch {}",
      "  return generated;",
      '})();',
      "const tenantId = (urlParams.get('tenant') || DEFAULT_TENANT_ID).trim() || DEFAULT_TENANT_ID;"
    ].join('\n');
  }

  function replaceLiteral(source, searchValue, replaceValue) {
    if (!source.includes(searchValue)) {
      throw new Error(`Expected template fragment not found: ${searchValue}`);
    }

    return source.replace(searchValue, replaceValue);
  }

  async function buildSdkArchiveBlob() {
    const [
      readme,
      minimalHtml,
      minimalAc2Host,
      demoSceneHtml,
      demoSceneCss,
      demoSceneAc2Host,
      demoSceneMain,
      demoSceneVrmScene
    ] = await Promise.all([
      fetchAsset('../demo/README.md', 'text'),
      fetchAsset('../demo/minimal/index.html', 'text'),
      fetchAsset('../demo/minimal/ac2-host.js', 'text'),
      fetchAsset('../demo/demo-scene/index.html', 'text'),
      fetchAsset('../demo/demo-scene/style.css', 'text'),
      fetchAsset('../demo/demo-scene/ac2-host.js', 'text'),
      fetchAsset('../demo/demo-scene/main.js', 'text'),
      fetchAsset('../demo/demo-scene/vrm-scene.js', 'text')
    ]);

    const customizedMinimalHtml = replaceLiteral(
      minimalHtml,
      "const tenantId = 'viverse';",
      renderRuntimeSdkTenantBootstrap()
    );

    const customizedDemoSceneMain = replaceLiteral(
      demoSceneMain,
      "const tenantId = (urlParams.get('tenant') || 'viverse').trim() || 'viverse';",
      renderRuntimeSdkTenantResolver()
    );

    return {
      archiveBlob: await buildZipBlob([
        {
          path: 'README.md',
          content: readme
        },
        {
          path: 'minimal/index.html',
          content: customizedMinimalHtml
        },
        {
          path: 'minimal/ac2-host.js',
          content: minimalAc2Host
        },
        {
          path: 'demo-scene/index.html',
          content: demoSceneHtml
        },
        {
          path: 'demo-scene/style.css',
          content: demoSceneCss
        },
        {
          path: 'demo-scene/ac2-host.js',
          content: demoSceneAc2Host
        },
        {
          path: 'demo-scene/main.js',
          content: customizedDemoSceneMain
        },
        {
          path: 'demo-scene/vrm-scene.js',
          content: demoSceneVrmScene
        }
      ]),
      archiveFilename: 'ac2-demo.zip'
    };
  }

  function getArchiveStem(value) {
    return String(value || 'avatar')
      .replace(/\.[^.]+$/, '')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '') || 'avatar';
  }

  function getArchivePaths(filename) {
    const vrmFilename = inferAvatarFilename(filename);
    const stem = getArchiveStem(vrmFilename);
    return {
      vrmFilename,
      thumbnailFilename: `${stem}-thumb.png`,
      archiveFilename: `${stem}.zip`
    };
  }

  async function getAvatarThumbnailModule() {
    if (!avatarThumbnailModulePromise) {
      avatarThumbnailModulePromise = import(new URL('./avatar-thumbnail.js', window.location.href).href);
    }
    return avatarThumbnailModulePromise;
  }

  async function createAvatarThumbnailBlob(vrmBlob, filename) {
    const module = await getAvatarThumbnailModule();
    return module.createAvatarThumbnailBlob(vrmBlob, {
      label: getArchiveStem(filename)
    });
  }

  async function buildAvatarArchiveBlob(vrmBlob, filename) {
    const paths = getArchivePaths(filename);
    const thumbnailBlob = await createAvatarThumbnailBlob(vrmBlob, paths.vrmFilename);
    const entries = [
      {
        path: paths.vrmFilename,
        content: vrmBlob
      },
      {
        path: paths.thumbnailFilename,
        content: thumbnailBlob
      }
    ];

    return {
      archiveBlob: await buildZipBlob(entries),
      archiveFilename: paths.archiveFilename
    };
  }

  function inferAvatarFilename(value) {
    const rawValue = String(value || '').trim();
    const lastSegment = rawValue ? rawValue.split('/').pop() : '';
    const baseName = (lastSegment || rawValue || 'avatar.vrm').replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_');
    return /\.vrm$/i.test(baseName) ? baseName : `${baseName}.vrm`;
  }

  function getSceneAvatarMeta() {
    if (embeddedVrmScene && typeof embeddedVrmScene.getCurrentAvatarMeta === 'function') {
      const sceneMeta = embeddedVrmScene.getCurrentAvatarMeta();
      if (sceneMeta && sceneMeta.key) {
        return {
          key: sceneMeta.key,
          fileName: inferAvatarFilename(sceneMeta.displayName || sceneMeta.fileName || sceneMeta.key)
        };
      }
    }

    if (state.pendingAvatarKey) {
      return {
        key: state.pendingAvatarKey,
        fileName: inferAvatarFilename(state.pendingFileName || state.pendingAvatarKey)
      };
    }

    return null;
  }

  async function resolveCurrentDownloadableAvatar() {
    const sceneMeta = getSceneAvatarMeta();
    if (sceneMeta) {
      if (state.pendingVrmBlob instanceof Blob && state.pendingAvatarKey && state.pendingAvatarKey === sceneMeta.key) {
        sceneMeta.blob = state.pendingVrmBlob;
      }
      return sceneMeta;
    }

    if (!hasAuthenticatedUser()) {
      return null;
    }

    const activeKey = await fetchActiveAvatar();
    if (!activeKey) {
      return null;
    }

    return {
      key: activeKey,
      fileName: inferAvatarFilename(activeKey)
    };
  }

  async function fetchAvatarBlobForDownload(key) {
    const result = await fetchDownloadUrl(key);
    const downloadUrl = result && result.url ? result.url : '';
    if (!downloadUrl) {
      throw new Error('No download URL is available for this avatar.');
    }

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download the avatar file (${response.status}).`);
    }

    return response.blob();
  }

  async function downloadAvatarArchive(avatar) {
    const nextAvatar = avatar || null;
    if (!nextAvatar || (!nextAvatar.blob && !nextAvatar.key)) {
      throw new Error('No active avatar is available to download.');
    }

    const filename = inferAvatarFilename(nextAvatar.fileName || nextAvatar.key || 'avatar.vrm');
    const vrmBlob = nextAvatar.blob instanceof Blob
      ? nextAvatar.blob
      : await fetchAvatarBlobForDownload(nextAvatar.key);
    const { archiveBlob, archiveFilename } = await buildAvatarArchiveBlob(vrmBlob, filename);
    const fileHandle = await requestArchiveFileHandle(archiveFilename);
    await saveBlobWithFileHandle(archiveBlob, fileHandle);
    return {
      archiveFilename
    };
  }

  async function handleSceneAvatarDownload() {
    if (state.downloading) {
      return;
    }

    let avatar = null;
    try {
      avatar = await resolveCurrentDownloadableAvatar();
    } catch (error) {
      console.error(error);
      if (embeddedVrmScene) {
        embeddedVrmScene.setAvatarText(error.message || 'Unable to resolve the active avatar.');
      }
      return;
    }

    if (!avatar || (!avatar.key && !(avatar.blob instanceof Blob))) {
      if (embeddedVrmScene) {
        embeddedVrmScene.setAvatarText('No active avatar is available to download.');
      }
      return;
    }

    state.downloading = true;
    syncVerificationButtons();
    syncSceneActionButtons();
    if (embeddedVrmScene) {
      embeddedVrmScene.setAvatarText(`Preparing ${inferAvatarFilename(avatar.fileName || avatar.key || 'avatar.vrm')}...`);
    }

    try {
      const result = await downloadAvatarArchive(avatar);
      if (embeddedVrmScene) {
        embeddedVrmScene.setAvatarText(`${result.archiveFilename} downloaded.`);
      }
    } catch (error) {
      if (!isFilePickerAbortError(error)) {
        console.error(error);
      }

      if (embeddedVrmScene) {
        embeddedVrmScene.setAvatarText(
          isFilePickerAbortError(error)
            ? 'Download was cancelled. You can try again.'
            : (error.message || 'Avatar ZIP download failed.')
        );
      }
    } finally {
      state.downloading = false;
      syncVerificationButtons();
      syncSceneActionButtons();
    }
  }

  async function handleSdkDownload() {
    if (!getSdkButton || getSdkButton.disabled) {
      return;
    }

    const originalText = getSdkButton.textContent;
    getSdkButton.disabled = true;
    getSdkButton.textContent = 'Preparing';

    try {
      const { archiveBlob, archiveFilename } = await buildSdkArchiveBlob();
      const fileHandle = await requestArchiveFileHandle(archiveFilename);
      await saveBlobWithFileHandle(archiveBlob, fileHandle);
      getSdkButton.textContent = 'Downloaded';
    } catch (error) {
      if (!isFilePickerAbortError(error)) {
        console.error(error);
      }
      getSdkButton.textContent = isFilePickerAbortError(error) ? originalText : 'Failed';
    } finally {
      window.setTimeout(() => {
        getSdkButton.disabled = false;
        if (getSdkButton.textContent !== 'Downloaded') {
          getSdkButton.textContent = originalText;
        }
      }, 1400);
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
      closeVerificationModal();
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

    state.downloading = true;
    syncVerificationButtons();
    setStatus(verificationStatus, 'Preparing ZIP download...');
    setDownloadCompleteState('Preparing ZIP download...', { tone: 'success' });

    try {
      if (!(state.pendingVrmBlob instanceof Blob)) {
        throw new Error('VRM data is no longer available on the landing page. Please create it again.');
      }

      await downloadAvatarArchive({
        key: state.pendingAvatarKey,
        fileName: state.pendingFileName || 'avatar.vrm',
        blob: state.pendingVrmBlob
      });

      state.authenticationPassed = true;
      state.verifiedForDownload = true;
      state.downloadCompletedOnce = true;
      setStatus(verificationStatus, 'Download complete.', 'success');
      setDownloadCompleteState('Download complete. Try playing your avatar when ready.', { tone: 'success' });
    } catch (error) {
      if (isFilePickerAbortError(error)) {
        setStatus(verificationStatus, 'Download was cancelled. You can try again.', 'error');
        setDownloadCompleteState('Download was cancelled. You can try again.', { tone: 'error' });
        return;
      }

      console.error(error);
      setStatus(verificationStatus, error.message || 'Avatar ZIP download failed.', 'error');
      setDownloadCompleteState(error.message || 'Avatar ZIP download failed.', { tone: 'error' });
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

    if (shouldShowDraftSaveAction()) {
      launchDraftCreator();
      return;
    }

    if (state.resumeToCreator && ac2Frame.getAttribute('src')) {
      reopenCreator();
      return;
    }

    launchDraftCreator();
  }

  function handleSceneOpenAc2Click() {
    if (hasAuthenticatedUser() && embeddedScene && embeddedScene.hidden) {
      showEmbeddedDemoScene();
    }

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
      openDownloadReadyModal('Your draft avatar is ready. Download it now or try playing your avatar.', { tone: 'success' });
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

  if (enterDemoSceneButton) {
    enterDemoSceneButton.addEventListener('click', () => {
      showEmbeddedDemoScene();
    });
  }

  if (getSdkButton) {
    getSdkButton.addEventListener('click', () => {
      handleSdkDownload();
    });
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

  if (landingPillOpenAc2Button) {
    landingPillOpenAc2Button.addEventListener('click', () => {
      handleSceneOpenAc2Click();
    });
  }

  if (landingPillCreateAvatarButton) {
    landingPillCreateAvatarButton.addEventListener('click', () => {
      launchDraftCreator();
    });
  }

  if (embeddedSceneBackButton) {
    embeddedSceneBackButton.addEventListener('click', () => {
      closeAc2Modal();
      hideEmbeddedDemoScene();
    });
  }

  if (landingPillSaveAccountButton) {
    landingPillSaveAccountButton.addEventListener('click', () => {
      openSaveAccountFlow();
    });
  }

  if (landingPillDownloadAvatarButton) {
    landingPillDownloadAvatarButton.addEventListener('click', () => {
      handleSceneAvatarDownload();
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
  syncSceneActionButtons();
  bootstrapCurrentUser();
})();
