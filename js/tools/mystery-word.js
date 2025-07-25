// js/tools/mystery-word.js

import { setPendingFullscreen } from '../main.js'; 
import { playSound, setScoreboardReturnState } from '../utils.js';

export function initMysteryWord() {
    const toolCard = document.getElementById('mystery-word-tool');
    const setupControls = document.getElementById('mw-setup-controls');
    const gameContainer = document.getElementById('mw-game-container');
    const wordInput = document.getElementById('mw-word-input');
    const toggleWordBtn = document.getElementById('mw-toggle-word-btn');
    const themeSelect = document.getElementById('mw-theme-select');
    const triesSelect = document.getElementById('mw-tries-select');
    const startGameBtn = document.getElementById('mw-start-game-btn');
    const visualImage = document.getElementById('mw-visual-image');
    const triesDisplay = document.getElementById('mw-tries-display');
    const wordDisplay = document.getElementById('mw-word-display');
    const keyboard = document.getElementById('mw-keyboard');
    const endGameOverlay = document.getElementById('mw-end-game-overlay');
    const endGameMessage = document.getElementById('mw-end-game-message');
    const revealedWord = document.getElementById('mw-revealed-word');
    const playAgainBtn = document.getElementById('mw-play-again-btn');
    const endGameCloseBtn = toolCard.querySelector('.mw-popup-close');
    const revealWordBtn = document.getElementById('mw-reveal-word-btn');
    const newGameBtn = document.getElementById('mw-new-game-btn');
    const goToScoreboardBtn = document.getElementById('mw-goto-scoreboard-btn');
    const confettiCanvas = document.getElementById('mw-confetti-canvas');

    let gameState = 'setup', secretWord = '', guessedLetters = new Set(), misses = 0, maxMisses = 7, currentTheme = 'rocket';

    function getDynamicStateNumber(currentMisses, maxAllowedMisses) {
        if (currentMisses === 0) return 0;
        if (currentMisses >= maxAllowedMisses) return 10;
        const progress = (currentMisses - 1) / (maxAllowedMisses - 1);
        return 1 + Math.round(progress * 9);
    }

    function resetToSetup() {
        gameState = 'setup';
        setupControls.classList.remove('hidden');
        gameContainer.classList.add('hidden');
        endGameOverlay.classList.add('hidden');
        wordInput.value = '';
        wordInput.type = 'password';
        toggleWordBtn.textContent = 'Show';
    }

    function startGame() {
        secretWord = wordInput.value.trim().toUpperCase();
        if (!secretWord) { alert('Please enter a word or phrase.'); return; }
        maxMisses = parseInt(triesSelect.value, 10);
        currentTheme = themeSelect.value;
        gameState = 'playing';
        guessedLetters.clear();
        misses = 0;
        setupControls.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        endGameOverlay.classList.add('hidden');
        generateKeyboard();
        renderWord();
        renderVisuals();
    }

    function generateKeyboard() {
        keyboard.innerHTML = '';
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
            const btn = document.createElement('button');
            btn.className = 'mw-key';
            btn.textContent = letter;
            btn.dataset.letter = letter;
            btn.addEventListener('click', () => handleGuess(letter));
            keyboard.appendChild(btn);
        });
    }

    function renderWord() {
        wordDisplay.innerHTML = '';
        let allLettersGuessed = true;
        secretWord.split(' ').forEach(word => {
            const wordWrapper = document.createElement('div');
            wordWrapper.className = 'mw-word-wrapper';
            for (const char of word) {
                const charContainer = document.createElement('div');
                if (/[A-Z]/.test(char) && guessedLetters.has(char)) {
                    charContainer.className = 'mw-letter';
                    charContainer.textContent = char;
                } else if (/[A-Z]/.test(char)) {
                    charContainer.className = 'mw-blank';
                    allLettersGuessed = false;
                } else { // Non-alphabetic characters
                    charContainer.className = 'mw-letter non-alpha';
                    charContainer.textContent = char;
                }
                wordWrapper.appendChild(charContainer);
            }
            wordDisplay.appendChild(wordWrapper);
        });
        if (allLettersGuessed && gameState === 'playing') { handleEndGame(true); }
    }

    function renderVisuals() {
        triesDisplay.textContent = `Misses Left: ${maxMisses - misses}`;
        const stateNumber = getDynamicStateNumber(misses, maxMisses);
        visualImage.src = `assets/mystery-word/${currentTheme}/state-${stateNumber}.png`;
    }

    function handleGuess(letter) {
        if (gameState !== 'playing' || guessedLetters.has(letter)) return;
        guessedLetters.add(letter);
        const keyButton = keyboard.querySelector(`[data-letter="${letter}"]`);
        if (secretWord.includes(letter)) {
            playSound('assets/sounds/point-up.mp3');
            if (keyButton) keyButton.classList.add('correct');
            renderWord();
        } else {
            playSound('assets/sounds/point-down.mp3');
            if (keyButton) keyButton.classList.add('incorrect');
            misses++;
            renderVisuals();
            if (misses >= maxMisses) { handleEndGame(false); }
        }
        if(keyButton) keyButton.disabled = true;
    }

    function handleEndGame(didWin) {
        gameState = didWin ? 'win' : 'lose';
        if (didWin) { playSound('assets/sounds/winner_reveal.mp3'); endGameMessage.textContent = '🎉 You Win! 🎉'; revealedWord.textContent = secretWord; triggerConfetti(); }
        else { playSound('assets/sounds/time-end.mp3'); endGameMessage.textContent = '😭 Game Over 😭'; revealedWord.textContent = `The word was: ${secretWord}`; }
        endGameOverlay.classList.remove('hidden');
    }

    function revealFullWord() { if (gameState === 'playing') { handleEndGame(false); } }
    function triggerConfetti() { if (typeof confetti !== 'function') return; const rect = confettiCanvas.getBoundingClientRect(); confetti({ particleCount: 150, spread: 90, origin: { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }, zIndex: 3000 }); }

    startGameBtn.addEventListener('click', startGame);
    playAgainBtn.addEventListener('click', resetToSetup);
    newGameBtn.addEventListener('click', resetToSetup);
    revealWordBtn.addEventListener('click', revealFullWord);
    endGameCloseBtn.addEventListener('click', () => endGameOverlay.classList.add('hidden'));
    toggleWordBtn.addEventListener('click', () => { wordInput.type = wordInput.type === 'password' ? 'text' : 'password'; toggleWordBtn.textContent = wordInput.type === 'password' ? 'Show' : 'Hide'; });

    // --- FIX: ROBUST SCOREBOARD INTEGRATION ---
    goToScoreboardBtn.addEventListener('click', () => {
        // 1. Set the state so the scoreboard knows where to return.
        setScoreboardReturnState('mystery-word-tool');

        // 2. Set the pending request for the central fullscreen manager.
        setPendingFullscreen('scoreboard-tool');
        
        const scoreboardCard = document.getElementById('scoreboard-tool');
        if (!scoreboardCard) return;

        // 3. Trigger the transition.
        // This robust pattern ensures the central handler in main.js manages the switch.
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            scoreboardCard.requestFullscreen();
        }
    });

    // --- Init ---
    resetToSetup();
}