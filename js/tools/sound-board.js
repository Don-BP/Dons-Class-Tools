// js/tools/sound-board.js

import { saveSoundBoard, getAllSoundBoards, deleteSoundBoard, importSoundBoards } from '../db.js';
import { openFileUploadModal } from '../main.js';

export function initSoundBoard() {
    const toolCard = document.getElementById('sound-board-tool');
    const playModeContainer = document.getElementById('sb-play-mode');
    const editModeContainer = document.getElementById('sb-edit-mode');
    const editBoardBtn = document.getElementById('sb-edit-btn');
    const exitEditBtn = document.getElementById('sb-exit-edit-btn');
    const musicLoadInput = document.getElementById('sb-music-load-input');
    const musicLoadLabel = document.querySelector('label[for="sb-music-load-input"]');
    const trackListDetails = document.getElementById('sb-track-list-details');
    const trackListUl = document.getElementById('sb-track-list-ul');
    const prevBtn = document.getElementById('sb-music-prev');
    const playPauseBtn = document.getElementById('sb-music-play');
    const nextBtn = document.getElementById('sb-music-next');
    const stopBtn = document.getElementById('sb-music-stop');
    const volumeSlider = document.getElementById('sb-music-volume');
    const currentTrackDisplay = document.getElementById('sb-current-track');
    const boardSelect = document.getElementById('sb-load-select');
    const boardNameInput = document.getElementById('sb-board-name-input');
    const saveBoardBtn = document.getElementById('sb-save-btn');
    const deleteBoardBtn = document.getElementById('sb-delete-btn');
    const exportBoardBtn = document.getElementById('sb-export-btn');
    const importBoardInput = document.getElementById('sb-import-input');
    const importBoardLabel = document.querySelector('label[for="sb-import-input"]');
    const addSoundBtn = document.getElementById('sb-add-sound-btn');
    const editGrid = document.getElementById('sb-buttons-grid-edit');

    let isEditMode = false;
    let currentBoard = [];
    let musicTracks = [];
    let currentMusicTrackIndex = -1;
    let masterVolume = 0.75;
    let activeSfx = null;
    let resizeObserver;

    function renderBoard() {
        const targetGrid = isEditMode ? editGrid : document.getElementById('sb-buttons-grid');
        if (!targetGrid) return;
        
        targetGrid.innerHTML = '';
        if (currentBoard.length === 0 && !isEditMode) {
            targetGrid.innerHTML = '<div class="sb-grid-placeholder">Click "Edit Board" to add sounds!</div>';
            return;
        }

        currentBoard.forEach(item => {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'sb-button-wrapper';

            if (isEditMode) {
                buttonWrapper.innerHTML = `
                    <div class="sb-button-edit-overlay">
                        <input type="file" class="sb-sound-upload-input" id="upload-${item.id}" accept="audio/*" style="display:none;">
                        <label for="upload-${item.id}" class="sb-edit-action sb-sound-upload-label" title="Load Sound">🎵</label>
                        <button class="sb-edit-action sb-delete-item-btn" title="Delete Button">🗑️</button>
                    </div>
                    <div class="sb-button-name" contenteditable="true" spellcheck="false">${item.name}</div>
                `;
                const nameDiv = buttonWrapper.querySelector('.sb-button-name');
                nameDiv.addEventListener('blur', () => { item.name = nameDiv.textContent.trim(); });
                const uploadInput = buttonWrapper.querySelector('.sb-sound-upload-input');
                uploadInput.addEventListener('change', (e) => handleSoundUpload(e, item));
                const deleteBtn = buttonWrapper.querySelector('.sb-delete-item-btn');
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`Delete button "${item.name}"?`)) {
                        currentBoard = currentBoard.filter(i => i.id !== item.id);
                        renderBoard();
                    }
                });
            } else {
                buttonWrapper.innerHTML = `<div class="sb-button-name">${item.name}</div>`;
                if (item.soundData) {
                    buttonWrapper.addEventListener('click', () => playSfx(item));
                } else {
                    buttonWrapper.classList.add('disabled');
                }
            }
            targetGrid.appendChild(buttonWrapper);
        });
        adjustGrid();
    }
    
    function adjustGrid() {
        const targetGrid = isEditMode ? editGrid : document.getElementById('sb-buttons-grid');
        if (!targetGrid || !targetGrid.isConnected || currentBoard.length === 0 || isEditMode) return;
        const containerWidth = targetGrid.clientWidth;
        const numItems = currentBoard.length;
        if (numItems === 0) return;
        let cols = Math.ceil(Math.sqrt(numItems * (targetGrid.clientHeight / containerWidth)));
        cols = Math.min(numItems, Math.max(1, cols));
        targetGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        requestAnimationFrame(() => {
            targetGrid.querySelectorAll('.sb-button-wrapper .sb-button-name').forEach(nameEl => {
                const wrapper = nameEl.parentElement;
                let fontSize = 40; 
                nameEl.style.fontSize = `${fontSize}px`;
                while ((nameEl.scrollWidth > wrapper.clientWidth - 10 || nameEl.scrollHeight > wrapper.clientHeight - 10) && fontSize > 8) {
                    fontSize--;
                    nameEl.style.fontSize = `${fontSize}px`;
                }
            });
        });
    }

    function playSfx(item) {
        if (!item.soundData) return;
        if (activeSfx) { activeSfx.pause(); activeSfx.currentTime = 0; activeSfx = null; }
        const sound = new Audio(item.soundData);
        sound.volume = masterVolume;
        activeSfx = sound;
        sound.onended = () => { if (activeSfx === sound) activeSfx = null; };
        sound.play().catch(e => console.error("Error playing sound:", e));
    }

    function handleSoundUpload(event, item) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            item.soundData = e.target.result;
            if (item.name === 'New Sound') {
                item.name = file.name.split('.').slice(0, -1).join('.') || 'Sound';
                renderBoard();
            }
        };
        reader.readAsDataURL(file);
    }

    function toggleEditMode() {
        isEditMode = !isEditMode;
        toolCard.classList.toggle('edit-mode', isEditMode);
        playModeContainer.classList.toggle('hidden', isEditMode);
        editModeContainer.classList.toggle('hidden', !isEditMode);
        renderBoard();
    }
    
    function renderTrackList() {
        trackListUl.innerHTML = '';
        musicTracks.forEach((track, index) => {
            const li = document.createElement('li');
            li.textContent = track.name; li.dataset.index = index;
            if (index === currentMusicTrackIndex) li.classList.add('playing');
            li.addEventListener('click', () => playMusic(index));
            trackListUl.appendChild(li);
        });
        trackListDetails.style.display = musicTracks.length > 0 ? 'block' : 'none';
    }
    
    function playMusic(index) {
        if (index < 0 || index >= musicTracks.length) return;
        if (currentMusicTrackIndex > -1 && musicTracks[currentMusicTrackIndex]) {
            musicTracks[currentMusicTrackIndex].audio.pause();
        }
        currentMusicTrackIndex = index;
        const track = musicTracks[currentMusicTrackIndex];
        track.audio.currentTime = 0; track.audio.volume = masterVolume;
        track.audio.play().catch(e => console.error("Error playing music:", e));
        playPauseBtn.textContent = '⏸️'; currentTrackDisplay.textContent = track.name;
        renderTrackList();
    }
    
    function togglePlayPause() {
        if (currentMusicTrackIndex === -1) { if (musicTracks.length > 0) playMusic(0); return; }
        const track = musicTracks[currentMusicTrackIndex].audio;
        if (track.paused) { track.play(); playPauseBtn.textContent = '⏸️'; } 
        else { track.pause(); playPauseBtn.textContent = '▶️'; }
    }

    async function updateBoardSelect() {
        const boards = await getAllSoundBoards();
        boardSelect.innerHTML = '<option value="">-- New Sound Board --</option>';
        for (const name in boards) {
            const option = document.createElement('option');
            option.value = name; option.textContent = name;
            boardSelect.appendChild(option);
        }
    }

    async function loadBoard() {
        const boardName = boardSelect.value;
        if (!boardName) {
            boardNameInput.value = ''; currentBoard = []; musicTracks = []; deleteBoardBtn.disabled = true;
        } else {
            const boardData = (await getAllSoundBoards())[boardName];
            if (boardData) {
                boardNameInput.value = boardName;
                currentBoard = boardData.sfx || [];
                musicTracks = (boardData.music || []).map(track => ({ name: track.name, audio: new Audio(track.data) }));
                deleteBoardBtn.disabled = false;
            }
        }
        renderBoard(); renderTrackList();
    }

    // --- Event Listeners ---
    editBoardBtn.addEventListener('click', toggleEditMode);
    exitEditBtn.addEventListener('click', toggleEditMode);
    
    addSoundBtn.addEventListener('click', () => {
        currentBoard.push({ id: `sb-item-${Date.now()}`, name: 'New Sound', soundData: null });
        renderBoard();
    });

    // ** THE FIX **: Use the centralized modal for music tracks.
    if (musicLoadLabel) {
        musicLoadLabel.addEventListener('click', (e) => {
            e.preventDefault();
            openFileUploadModal('sound-board-tool', 'sb-music-load-input', 'Load Music Tracks');
        });
    }

    // ** THE FIX **: Use the centralized modal for importing boards.
    if (importBoardLabel) {
        importBoardLabel.addEventListener('click', (e) => {
            e.preventDefault();
            openFileUploadModal('sound-board-tool', 'sb-import-input', 'Import Sound Boards');
        });
    }

    // ** THE FIX **: Use the centralized modal for individual SFX buttons.
    if (editGrid) {
        editGrid.addEventListener('click', (e) => {
            const label = e.target.closest('.sb-sound-upload-label');
            if (label) {
                e.preventDefault();
                const inputId = label.getAttribute('for');
                openFileUploadModal('sound-board-tool', inputId, 'Upload Sound Effect');
            }
        });
    }
    
    musicLoadInput.addEventListener('change', (e) => {
        const files = e.target.files; if (!files.length) return;
        const wasEmpty = musicTracks.length === 0;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (re) => {
                const audio = new Audio(re.target.result);
                audio.onended = () => playMusic((currentMusicTrackIndex + 1) % musicTracks.length);
                musicTracks.push({ name: file.name, audio });
                renderTrackList();
            };
            reader.readAsDataURL(file);
        });
        if (wasEmpty) {
            setTimeout(() => {
                if (musicTracks.length > 0) {
                    currentMusicTrackIndex = 0; currentTrackDisplay.textContent = musicTracks[0].name; renderTrackList();
                }
            }, 100);
        }
        e.target.value = '';
    });
    
    playPauseBtn.addEventListener('click', togglePlayPause);
    stopBtn.addEventListener('click', () => {
        if (currentMusicTrackIndex > -1 && musicTracks[currentMusicTrackIndex]) {
            const track = musicTracks[currentMusicTrackIndex].audio;
            track.pause(); track.currentTime = 0;
            playPauseBtn.textContent = '▶️'; currentTrackDisplay.textContent = 'No track playing';
            currentMusicTrackIndex = -1; renderTrackList();
        }
    });
    
    nextBtn.addEventListener('click', () => { if (musicTracks.length > 0) playMusic((currentMusicTrackIndex + 1) % musicTracks.length); });
    prevBtn.addEventListener('click', () => { if (musicTracks.length > 0) playMusic((currentMusicTrackIndex - 1 + musicTracks.length) % musicTracks.length); });
    volumeSlider.addEventListener('input', (e) => {
        masterVolume = parseFloat(e.target.value);
        if (currentMusicTrackIndex > -1 && musicTracks[currentMusicTrackIndex]) {
            musicTracks[currentMusicTrackIndex].audio.volume = masterVolume;
        }
    });
    
    boardSelect.addEventListener('change', loadBoard);

    saveBoardBtn.addEventListener('click', async () => {
        const boardName = boardNameInput.value.trim();
        if (!boardName) { alert('Please enter a name for the sound board.'); return; }
        const boardData = { sfx: currentBoard, music: musicTracks.map(t => ({ name: t.name, data: t.audio.src })) };
        await saveSoundBoard(boardName, boardData);
        alert(`Board "${boardName}" saved.`);
        await updateBoardSelect(); boardSelect.value = boardName; deleteBoardBtn.disabled = false;
    });

    deleteBoardBtn.addEventListener('click', async () => {
        const boardName = boardSelect.value;
        if (!boardName || !confirm(`Delete the board "${boardName}"?`)) return;
        await deleteSoundBoard(boardName);
        alert(`Board "${boardName}" deleted.`);
        await updateBoardSelect(); boardSelect.value = ''; loadBoard();
    });

    exportBoardBtn.addEventListener('click', async () => {
        const boards = await getAllSoundBoards();
        if (Object.keys(boards).length === 0) { alert('No custom boards to export.'); return; }
        const blob = new Blob([JSON.stringify(boards, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'don-sound-boards.json';
        a.click(); URL.revokeObjectURL(a.href);
    });

    importBoardInput.addEventListener('change', async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const text = await file.text();
        try {
            await importSoundBoards(JSON.parse(text));
            alert('Sound boards imported successfully!');
            await updateBoardSelect(); boardSelect.value = ''; loadBoard();
        } catch (error) {
            alert('Import failed. Invalid file format.'); console.error(error);
        }
        e.target.value = '';
    });
    
    resizeObserver = new ResizeObserver(adjustGrid);
    const playGrid = document.getElementById('sb-buttons-grid');
    if (playGrid) resizeObserver.observe(playGrid);
    
    volumeSlider.value = masterVolume;
    updateBoardSelect();
    renderBoard();
}