// js/main.js

import { toggleMute, updateAllFlashcardCategorySelects, setScoreboardReturnState, getScoreboardReturnState, clearScoreboardReturnState } from './utils.js';
import { initDateWeather } from './tools/date-weather.js';
import { initTimer } from './tools/timer.js';
import { initFlashcards } from './tools/flashcards.js';
import ThemedScoreboard from './tools/scoreboard.js';
import { initWhatsMissing } from './tools/whats-missing.js';
import { initImageReveal } from './tools/image-reveal.js';
import { initFlashcardManager } from './tools/flashcard-manager.js';
import { initBingoPicker } from './tools/bingo-picker.js';
import { initWhiteboard } from './tools/whiteboard.js';
import { initSpinner } from './tools/spinner.js';
import { DiceRoller } from './tools/dice-roller.js';
import { initNoiseMeter } from './tools/noise-meter.js';
import { initAnswerMeThis } from './tools/answer-me-this.js';
import { initPhonics } from './tools/phonics.js';
import { initMysteryWord } from './tools/mystery-word.js';
import { initLessonMenu } from './tools/lesson-menu.js';
import { initSoundBoard } from './tools/sound-board.js';
import { initDB } from './db.js';

// --- STATE FOR MANAGING TRANSITIONS ---
let pendingFullscreenRequest = null;
let lastFullscreenTool = null;
let restoreToolIdOnConfirm = null; 

export function setPendingFullscreen(toolId) {
    pendingFullscreenRequest = toolId;
}

export function openFileUploadModal(toolId, inputId, title = 'Upload File', prompt = 'Please select a file to upload.') {
    const modal = document.getElementById('file-upload-modal');
    const titleEl = document.getElementById('file-upload-title');
    const promptEl = document.getElementById('file-upload-prompt');
    const confirmBtn = document.getElementById('file-upload-confirm-btn');
    const cancelBtn = document.getElementById('file-upload-cancel-btn');
    const targetInput = document.getElementById(inputId);
    const confirmPage = document.getElementById('upload-confirm-page');

    if (!modal || !targetInput || !confirmPage) {
        console.error('File upload modal, target input, or confirm page not found!');
        document.getElementById(inputId)?.click(); // Fallback
        return;
    }

    // Configure and show the initial modal
    titleEl.textContent = title;
    promptEl.textContent = prompt;
    modal.classList.remove('hidden');

    const handleConfirm = () => {
        modal.classList.add('hidden'); // Hide the first popup

        // Check if the tool is currently in fullscreen.
        if (document.fullscreenElement && document.fullscreenElement.id === toolId) {
            restoreToolIdOnConfirm = toolId; // Save the tool ID to restore
            confirmPage.classList.remove('hidden'); // Show our "skinned white page"
        }
        
        targetInput.click();
        cleanup();
    };

    const handleCancel = () => {
        modal.classList.add('hidden');
        cleanup();
    };

    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
    };
    
    confirmBtn.addEventListener('click', handleConfirm, { once: true });
    cancelBtn.addEventListener('click', handleCancel, { once: true });
}


// --- Global App Logic ---
function initializeAudio() {
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.addEventListener('click', () => {
        const isNowMuted = toggleMute();
        muteBtn.innerHTML = isNowMuted ? '🔇' : '🔊';
        muteBtn.title = isNowMuted ? 'Unmute' : 'Mute';
    });
}

function initializeFavorites() {
    const FAVORITES_KEY = 'donToolFavorites';
    const favoriteFilterBtn = document.getElementById('favorite-filter-btn');
    const allToolCards = document.querySelectorAll('.tool-card');
    const getFavorites = () => JSON.parse(localStorage.getItem(FAVORITES_KEY)) || [];
    const saveFavorites = (favorites) => localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    favoriteFilterBtn.addEventListener('click', () => {
        document.body.classList.toggle('favorites-active');
        const isActive = document.body.classList.contains('favorites-active');
        favoriteFilterBtn.classList.toggle('active', isActive);
        favoriteFilterBtn.innerHTML = isActive ? '♥' : '♡';
        favoriteFilterBtn.title = isActive ? 'Show All Tools' : 'Show Favorites';
    });
    allToolCards.forEach(card => {
        if (!card.id) return;
        const favBtn = card.querySelector('.favorite-btn');
        if (!favBtn) return;
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isFavorited = card.classList.toggle('favorited');
            favBtn.classList.toggle('is-favorite', isFavorited);
            favBtn.innerHTML = isFavorited ? '♥' : '♡';
            let currentFavorites = getFavorites();
            if (isFavorited) {
                if (!currentFavorites.includes(card.id)) currentFavorites.push(card.id);
            } else {
                currentFavorites = currentFavorites.filter(id => id !== card.id);
            }
            saveFavorites(currentFavorites);
        });
    });
    const savedFavorites = getFavorites();
    savedFavorites.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.add('favorited');
            const favBtn = card.querySelector('.favorite-btn');
            if (favBtn) { favBtn.classList.add('is-favorite'); favBtn.innerHTML = '♥'; }
        }
    });
}

function initNamePicker() {
    const namePickerCard = document.getElementById('name-picker-fireworks').closest('.tool-card');
    const nameList = document.getElementById('name-list');
    const pickNameBtn = document.getElementById('pick-name-btn');
    const pickedNameDisplay = document.getElementById('picked-name');
    const dontPickAgainCheck = document.getElementById('dont-pick-again-check');
    const pickedNamesContainer = document.getElementById('picked-names-container');
    const pickedNamesList = document.getElementById('picked-names-list');
    const nameListCollapser = document.querySelector('.name-list-collapsible');
    const fireworksContainer = document.getElementById('name-picker-fireworks');
    const resetBtn = document.getElementById('name-picker-reset-btn');
    const undoBtn = document.getElementById('undo-btn');
    const groupPickerControls = document.getElementById('group-picker-fullscreen-controls');
    const groupSizeInput = document.getElementById('group-size-input');
    const pickOneGroupBtn = document.getElementById('pick-one-group-btn');
    const groupAllBtn = document.getElementById('group-all-btn');
    const confirmPopup = document.getElementById('np-confirm-popup');
    const confirmResetBtn = document.getElementById('np-confirm-reset-btn');
    const cancelResetBtn = document.getElementById('np-cancel-reset-btn');
    let availableNames = [], pickedNames = [], history = [], currentDisplayState = null;
    function triggerFireworks(count = 1) { for (let i = 0; i < count; i++) { setTimeout(() => { const firework = document.createElement('div'); firework.className = 'firework'; firework.style.left = `${Math.random() * 100}%`; firework.style.top = `${Math.random() * 100}%`; const particleCount = 30 + Math.floor(Math.random() * 20); const hue = Math.floor(Math.random() * 360); for (let j = 0; j < particleCount; j++) { const particle = document.createElement('div'); particle.className = 'particle'; const angle = Math.random() * 360; const distance = 50 + Math.random() * 100; particle.style.setProperty('--transform-end', `translate(${Math.cos(angle * Math.PI / 180) * distance}px, ${Math.sin(angle * Math.PI / 180) * distance}px)`); particle.style.backgroundColor = `hsl(${hue}, 100%, 50%)`; firework.appendChild(particle); } fireworksContainer.appendChild(firework); setTimeout(() => firework.remove(), 2500); }, i * 200); } }
    function shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[array[i], array[j]] = [array[j], array[i]]; } }
    function renderDisplay() { pickedNameDisplay.innerHTML = ''; if (!currentDisplayState) return; if (!namePickerCard.classList.contains('fullscreen-mode') && currentDisplayState.type !== 'single') { return; } const { type, data } = currentDisplayState; if (type === 'single') { const nameEl = document.createElement('div'); nameEl.className = 'picked-name-single'; nameEl.textContent = data[0]; pickedNameDisplay.appendChild(nameEl); requestAnimationFrame(() => { const container = pickedNameDisplay; if (!container || !nameEl) return; let currentFontSize = parseFloat(window.getComputedStyle(nameEl).fontSize); nameEl.style.fontSize = `${currentFontSize}px`; while ((nameEl.scrollWidth > container.clientWidth || nameEl.scrollHeight > container.clientHeight) && currentFontSize > 10) { currentFontSize -= 1; nameEl.style.fontSize = `${currentFontSize}px`; } }); } else if (type === 'group') { const groupContainer = document.createElement('div'); groupContainer.className = 'single-group-container'; data.forEach(name => { const memberEl = document.createElement('div'); memberEl.className = 'single-group-member'; memberEl.textContent = name; groupContainer.appendChild(memberEl); }); pickedNameDisplay.appendChild(groupContainer); } else if (type === 'all') { const container = document.createElement('div'); container.className = 'group-all-container'; data.forEach((group) => { const groupBox = document.createElement('div'); groupBox.className = 'group-box'; const memberList = document.createElement('ul'); group.forEach(name => { const memberItem = document.createElement('li'); memberItem.textContent = name; memberList.appendChild(memberItem); }); groupBox.appendChild(memberList); container.appendChild(groupBox); }); pickedNameDisplay.appendChild(container); requestAnimationFrame(() => { if (!container) return; let currentFontSize = 40; container.style.fontSize = `${currentFontSize}px`; while ((container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth) && currentFontSize > 5) { currentFontSize -= 1; container.style.fontSize = `${currentFontSize}px`; } }); } }
    function resetPickerState() { const allNames = nameList.value.split('\n').map(name => name.trim()).filter(name => name !== ''); availableNames = [...new Set(allNames)]; pickedNames = []; history = []; currentDisplayState = null; renderDisplay(); updateUI(); }
    function updateNameListsFromTextarea() { resetPickerState(); }
    function autoCloseCollapserOnMobile() { if (window.innerWidth <= 768 && nameListCollapser.open) { nameListCollapser.open = false; } }
    function updateUI() { pickedNamesList.innerHTML = ''; if (pickedNames.length > 0) { pickedNames.sort().forEach(name => { const li = document.createElement('li'); li.textContent = name; pickedNamesList.appendChild(li); }); pickedNamesContainer.classList.remove('hidden'); } else { pickedNamesContainer.classList.add('hidden'); } const canPick = availableNames.length > 0; pickNameBtn.disabled = !canPick; pickOneGroupBtn.disabled = !canPick; groupAllBtn.disabled = !canPick; resetBtn.disabled = pickedNames.length === 0 && history.length === 0 && !currentDisplayState; undoBtn.disabled = history.length === 0; }
    function saveToHistory(type, names) { history.push({ type, names: [...names], display: currentDisplayState }); }
    function pickSingleName() { if (availableNames.length === 0) { currentDisplayState = { type: 'single', data: ['All picked!'] }; renderDisplay(); return; } const randomIndex = Math.floor(Math.random() * availableNames.length); const selectedName = availableNames[randomIndex]; saveToHistory('single', [selectedName]); if (dontPickAgainCheck.checked) { availableNames.splice(randomIndex, 1); pickedNames.push(selectedName); } currentDisplayState = { type: 'single', data: [selectedName] }; renderDisplay(); triggerFireworks(3); autoCloseCollapserOnMobile(); updateUI(); }
    function pickOneGroup() { const groupSize = parseInt(groupSizeInput.value, 10); if (isNaN(groupSize) || groupSize < 2 || availableNames.length < groupSize) return; const selectedGroup = []; const tempAvailable = [...availableNames]; shuffleArray(tempAvailable); for (let i = 0; i < groupSize; i++) { selectedGroup.push(tempAvailable.pop()); } saveToHistory('group', selectedGroup); if (dontPickAgainCheck.checked) { availableNames = availableNames.filter(name => !selectedGroup.includes(name)); pickedNames.push(...selectedGroup); } currentDisplayState = { type: 'group', data: selectedGroup }; renderDisplay(); triggerFireworks(4); autoCloseCollapserOnMobile(); updateUI(); }
    function groupAll() { const groupSize = parseInt(groupSizeInput.value, 10); if (isNaN(groupSize) || groupSize < 2 || availableNames.length === 0) return; saveToHistory('all', [...availableNames]); const shuffled = [...availableNames]; shuffleArray(shuffled); const allGroups = []; while (shuffled.length > 0) { allGroups.push(shuffled.splice(0, groupSize)); } if (dontPickAgainCheck.checked) { pickedNames.push(...availableNames); availableNames = []; } currentDisplayState = { type: 'all', data: allGroups }; renderDisplay(); triggerFireworks(10); autoCloseCollapserOnMobile(); updateUI(); }
    function undoLastPick() { if (history.length === 0) return; const lastAction = history.pop(); const namesToRestore = lastAction.names; if (dontPickAgainCheck.checked) { pickedNames = pickedNames.filter(name => !namesToRestore.includes(name)); availableNames.push(...namesToRestore); availableNames = [...new Set(availableNames)]; } currentDisplayState = lastAction.display; renderDisplay(); updateUI(); }
    nameList.addEventListener('input', updateNameListsFromTextarea);
    pickNameBtn.addEventListener('click', pickSingleName);
    dontPickAgainCheck.addEventListener('change', resetPickerState);
    resetBtn.addEventListener('click', () => confirmPopup.classList.remove('hidden'));
    confirmResetBtn.addEventListener('click', () => { resetPickerState(); confirmPopup.classList.add('hidden'); });
    cancelResetBtn.addEventListener('click', () => confirmPopup.classList.add('hidden'));
    pickOneGroupBtn.addEventListener('click', pickOneGroup);
    groupAllBtn.addEventListener('click', groupAll);
    undoBtn.addEventListener('click', undoLastPick);
    updateNameListsFromTextarea();
}

/**
 * ** THE FIX **: Centralized handler for all "Go to Scoreboard" buttons is now smarter.
 */
function initializeScoreboardIntegration() {
    const integrationButtons = document.querySelectorAll('[id$="-goto-scoreboard-btn"]');
    const scoreboardTool = document.getElementById('scoreboard-tool');

    if (!scoreboardTool) {
        console.error("Scoreboard tool card not found. Integration will not work.");
        return;
    }

    integrationButtons.forEach(button => {
        button.addEventListener('click', () => {
            const parentToolCard = button.closest('.tool-card');
            if (parentToolCard && parentToolCard.id) {
                // Always set the "return address" so the scoreboard knows where to go back to.
                setScoreboardReturnState(parentToolCard.id);

                // Check if we are currently in fullscreen mode.
                if (document.fullscreenElement) {
                    // If we are, we must exit first, and then let the `fullscreenchange`
                    // event handler take us to the scoreboard.
                    setPendingFullscreen('scoreboard-tool');
                    document.exitFullscreen();
                } else {
                    // If we're not in fullscreen, we can just go directly.
                    scoreboardTool.requestFullscreen();
                }
            } else {
                console.warn("Could not find parent tool card for scoreboard integration button:", button);
            }
        });
    });
}


function initializeFullscreenLogic() {
    const confirmPage = document.getElementById('upload-confirm-page');
    const closeConfirmBtn = document.getElementById('upload-confirm-close-btn');

    if (closeConfirmBtn && confirmPage) {
        closeConfirmBtn.addEventListener('click', () => {
            confirmPage.classList.add('hidden');
            if (restoreToolIdOnConfirm) {
                const toolToRestore = document.getElementById(restoreToolIdOnConfirm);
                if (toolToRestore && !document.fullscreenElement) {
                    toolToRestore.requestFullscreen();
                }
                restoreToolIdOnConfirm = null; // Reset the state
            }
        });
    }

    document.querySelectorAll('.tool-card').forEach(card => {
        const h2 = card.querySelector('h2');
        if (h2) {
            const fullscreenBtn = document.createElement('button');
            fullscreenBtn.className = 'fullscreen-btn';
            fullscreenBtn.title = 'Toggle Fullscreen';
            fullscreenBtn.innerHTML = '↗️';
            h2.after(fullscreenBtn);
            fullscreenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.fullscreenElement ? document.exitFullscreen() : card.requestFullscreen();
            });
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const currentlyInFullscreen = !!document.fullscreenElement;
        
        if (!currentlyInFullscreen) {
            if (lastFullscreenTool) {
                // --- THIS IS THE FIX ---
                // 1. Capture the element in a local constant before it gets nulled.
                const exitedTool = lastFullscreenTool; 
                
                // 2. Reset its view to default.
                resetToolViewToDefault(exitedTool);

                // 3. Schedule the scroll command in a timeout.
                // This ensures it runs *after* the browser's default scroll-to-top action.
                // The `exitedTool` constant is safely used here because it was captured.
                setTimeout(() => {
                    exitedTool.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 0);
            }

            // This block handles chained fullscreen requests (e.g., game -> scoreboard)
            if (pendingFullscreenRequest) {
                const toolIdToEnter = pendingFullscreenRequest;
                pendingFullscreenRequest = null;
                const nextTool = document.getElementById(toolIdToEnter);
                
                if (nextTool) {
                    // Use a timeout to ensure the browser has finished exiting
                    // before we request to enter again. This is crucial.
                    setTimeout(() => nextTool.requestFullscreen(), 0);
                    return; // Prevent other cleanup logic from running
                }
            }

            // If we are in the upload process, the confirm page handler will take over.
            // Otherwise, do normal cleanup.
            if (!restoreToolIdOnConfirm) {
                document.body.classList.remove('has-fullscreen-tool');
                clearScoreboardReturnState(); // Clear return state on normal exit
                lastFullscreenTool = null;
            }
        } else {
            if (document.fullscreenElement.classList.contains('tool-card')) {
                document.body.classList.add('has-fullscreen-tool');
                lastFullscreenTool = document.fullscreenElement;
                activateToolFullscreenView(lastFullscreenTool);
            } else {
                document.body.classList.remove('has-fullscreen-tool');
                lastFullscreenTool = null;
            }
        }

        document.querySelectorAll('.tool-card').forEach(card => {
            const isThisCardFullscreen = (card === document.fullscreenElement);
            card.classList.toggle('fullscreen-mode', isThisCardFullscreen);
            const btn = card.querySelector('.fullscreen-btn');
            if (btn) btn.innerHTML = isThisCardFullscreen ? '↙️' : '↗️';
        });
    });
}

function activateToolFullscreenView(card) {
    if (!card) return;
    
    // Move all popups into the fullscreen card for correct positioning
    const allPopups = document.querySelectorAll('.confirm-popup');
    if (allPopups.length > 0) {
        allPopups.forEach(popup => card.appendChild(popup));
    }
    
    if (card.id === 'scoreboard-tool') ThemedScoreboard.activate();
    if (card.id === 'dice-roller-tool') DiceRoller.enterFullscreen();
    if (card.id === 'image-reveal-tool') card.querySelector('.fullscreen-btn')?.before(document.getElementById('ir-sequence-status'));
    
    const gridView = card.querySelector('.phonics-grid-view, #spinner-grid-view, #lm-menu-display-grid, #group-picker-fullscreen-controls');
    const fullscreenView = card.querySelector('.phonics-fullscreen-view, #spinner-fullscreen-view, #lm-fullscreen-view');

    if (card.id === 'name-picker-tool' && gridView) {
        gridView.classList.remove('hidden');
    } else if (gridView && fullscreenView) {
        gridView.classList.add('hidden');
        fullscreenView.classList.remove('hidden');
    }

    if (card.id === 'spinner-tool') window.dispatchEvent(new Event('resize'));
}

function resetToolViewToDefault(card) {
    if (!card) return;

    // Move popups back to the body for cleanup
    const allPopups = document.querySelectorAll('.confirm-popup');
    if (allPopups.length > 0) {
       allPopups.forEach(popup => document.body.appendChild(popup));
    }
    
    if (card.id === 'scoreboard-tool') ThemedScoreboard.deactivate();
    if (card.id === 'dice-roller-tool') DiceRoller.exitFullscreen();
    if (card.id === 'image-reveal-tool') document.getElementById('ir-status-bar')?.prepend(document.getElementById('ir-sequence-status'));
    
    const gridView = card.querySelector('.phonics-grid-view, #spinner-grid-view, #lm-menu-display-grid');
    const fullscreenView = card.querySelector('.phonics-fullscreen-view, #spinner-fullscreen-view, #lm-fullscreen-view');
    if (gridView && fullscreenView) {
        gridView.classList.remove('hidden');
        fullscreenView.classList.add('hidden');
    }
    
    if (card.id === 'flashcards-tool-card-id') card.classList.remove('grid-view-active');
    if (card.id === 'jeopardy-tool') {
        card.querySelector('#jeopardy-play-mode')?.classList.remove('hidden');
        card.querySelector('#jeopardy-edit-mode')?.classList.add('hidden');
    }
    if (card.id === 'sound-board-tool') {
        card.classList.remove('edit-mode');
        card.querySelector('#sb-play-mode')?.classList.remove('hidden');
        card.querySelector('#sb-edit-mode')?.classList.add('hidden');
    }
    if (card.id === 'name-picker-tool') {
        card.querySelector('#group-picker-fullscreen-controls')?.classList.add('hidden');
    }
}

async function initializeApp() {
    initializeAudio();
    initializeFullscreenLogic();
    initializeFavorites();
    initializeScoreboardIntegration(); // ** This now has the correct logic **
    await initDB();
    await updateAllFlashcardCategorySelects();
    initDateWeather();
    initNamePicker();
    initTimer();
    initFlashcards();
    ThemedScoreboard.init();
    initWhatsMissing();
    initImageReveal();
    initFlashcardManager();
    initBingoPicker();
    initWhiteboard();
    initSpinner();
    DiceRoller.init();
    initNoiseMeter();
    initPhonics();
    initAnswerMeThis();
    initMysteryWord();
    initLessonMenu();
    initSoundBoard();
    console.log("DonDB Classroom Tools Initialized with IndexedDB!");
}

document.addEventListener('DOMContentLoaded', initializeApp);