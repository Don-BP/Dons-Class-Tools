// js/tools/lesson-menu.js

import { saveLessonMenu, getAllLessonMenus, deleteLessonMenu, importLessonMenus } from '../db.js';

export function initLessonMenu() {
    // --- DOM Elements ---
    const toolCard = document.getElementById('lesson-menu-tool');
    const menuDisplayGrid = document.getElementById('lm-menu-display-grid');
    const menuDisplayFullscreen = document.getElementById('lm-menu-display-fullscreen');
    const activityButtonsContainer = document.getElementById('lm-activity-buttons');
    const customActivityInput = document.getElementById('lm-custom-activity-input');
    const customTimeInput = document.getElementById('lm-custom-time-input');
    const addCustomBtn = document.getElementById('lm-add-custom-btn');
    const loadSelect = document.getElementById('lm-load-select');
    const menuNameInput = document.getElementById('lm-menu-name-input');
    const saveBtn = document.getElementById('lm-save-btn');
    const deleteBtn = document.getElementById('lm-delete-btn');
    const exportBtn = document.getElementById('lm-export-btn');
    const importInput = document.getElementById('lm-import-input');
    const customNotesInput = document.getElementById('lm-custom-notes-input');
    const customNotesToggle = document.getElementById('lm-custom-notes-toggle');
    const totalTimeDisplay = document.getElementById('lm-total-time');
    const fullscreenView = document.getElementById('lm-fullscreen-view');
    const panelToggleBtn = document.getElementById('lm-panel-toggle-btn');


    // --- State ---
    let currentMenuItems = [];
    let draggedItem = null;
    const PRESET_ACTIVITIES = ["Greeting", "Warm-up", "Demo", "Practice", "Activity", "Speaking", "Listening", "Game", "Quiz", "Review"];

    // --- Core Functions ---

    function getActivitySlug(text) {
        const slug = text.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (PRESET_ACTIVITIES.map(a => a.toLowerCase().replace('-', '')).includes(slug)) {
            return slug;
        }
        if (slug === 'warmup') return 'warmup'; 
        return 'custom';
    }

    function toggleClearedState(index) {
        if (currentMenuItems[index]) {
            currentMenuItems[index].cleared = !currentMenuItems[index].cleared;
            renderMenu();
        }
    }

    function calculateTotalTime() {
        const totalMinutes = currentMenuItems.reduce((total, item) => {
            if (item.time && typeof item.time === 'string') {
                const timeMatch = item.time.match(/\d+/);
                if (timeMatch) {
                    return total + parseInt(timeMatch[0], 10);
                }
            }
            return total;
        }, 0);

        totalTimeDisplay.textContent = `${totalMinutes} min`;
    }

    /**
     * Dynamically adjusts font size on DESKTOP ONLY.
     * On mobile, fixed CSS sizes are used for better readability.
     */
    function adjustMenuFontSize() {
        const container = menuDisplayFullscreen;

        // --- THIS IS THE FIX ---
        // On mobile, we use fixed CSS sizes. Remove any JS-set size and exit.
        if (window.innerWidth <= 768) {
            container.style.removeProperty('--menu-item-font-size');
            return;
        }
        // --- END OF FIX ---

        if (container.offsetParent === null || currentMenuItems.length === 0) return;

        let fontSize = 2.5; 
        container.style.setProperty('--menu-item-font-size', `${fontSize}rem`);

        const minFontSize = 0.8;

        const isOverflowing = () => {
            if (container.scrollHeight > container.clientHeight) return true;
            const items = container.querySelectorAll('.lm-menu-item');
            for (const item of items) {
                if (item.scrollWidth > item.clientWidth + 2) return true;
            }
            return false;
        };

        while (isOverflowing() && fontSize > minFontSize) {
            fontSize -= 0.1;
            container.style.setProperty('--menu-item-font-size', `${fontSize}rem`);
        }
    }


    function renderMenu() {
        menuDisplayGrid.innerHTML = '';
        menuDisplayFullscreen.innerHTML = '';

        if (currentMenuItems.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'lm-placeholder';
            placeholder.textContent = toolCard.classList.contains('fullscreen-mode')
                ? 'Add an activity from the panel to start building your menu!'
                : 'Go fullscreen to build your lesson menu!';
            menuDisplayGrid.appendChild(placeholder.cloneNode(true));
            menuDisplayFullscreen.appendChild(placeholder);
            calculateTotalTime();
            return;
        }

        const fragmentGrid = document.createDocumentFragment();
        const fragmentFullscreen = document.createDocumentFragment();

        currentMenuItems.forEach((item, index) => {
            const menuItemEl = document.createElement('div');
            menuItemEl.className = 'lm-menu-item';
            menuItemEl.dataset.index = index;
            menuItemEl.dataset.activity = getActivitySlug(item.text);

            if (item.cleared) {
                menuItemEl.classList.add('cleared');
            }

            const dragHandle = document.createElement('span');
            dragHandle.className = 'lm-item-drag-handle';
            dragHandle.innerHTML = '☰';
            dragHandle.draggable = true;
            menuItemEl.appendChild(dragHandle);

            const itemText = document.createElement('span');
            itemText.className = 'lm-item-text';
            itemText.textContent = item.text;
            menuItemEl.appendChild(itemText);

            if (item.time) {
                const itemTime = document.createElement('span');
                itemTime.className = 'lm-item-time';
                itemTime.textContent = item.time;
                menuItemEl.appendChild(itemTime);
            }
            
            const itemControls = document.createElement('div');
            itemControls.className = 'lm-item-controls';

            const notesBtn = document.createElement('button');
            notesBtn.className = 'lm-item-notes-btn';
            notesBtn.innerHTML = '📝';
            notesBtn.title = 'Toggle Notes';
            itemControls.appendChild(notesBtn);

            const checkBtn = document.createElement('button');
            checkBtn.className = 'lm-item-check-btn';
            checkBtn.innerHTML = '✓';
            checkBtn.title = 'Mark as Completed';
            itemControls.appendChild(checkBtn);

            const deleteItemBtn = document.createElement('button');
            deleteItemBtn.className = 'lm-item-delete';
            deleteItemBtn.innerHTML = '×';
            deleteItemBtn.title = 'Remove item';
            deleteItemBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentMenuItems.splice(index, 1);
                renderMenu();
            });
            itemControls.appendChild(deleteItemBtn);
            
            menuItemEl.appendChild(itemControls);

            const stampImg = document.createElement('img');
            stampImg.src = 'assets/lesson-menu/clear-stamp.png';
            stampImg.className = 'lm-item-stamp';
            stampImg.alt = 'Cleared Stamp';
            menuItemEl.appendChild(stampImg);

            if (item.notes) {
                const notesEl = document.createElement('div');
                notesEl.className = 'lm-item-notes';
                notesEl.textContent = item.notes;
                menuItemEl.appendChild(notesEl);
            }

            if (item.isNew) {
                menuItemEl.classList.add('animate-in');
                setTimeout(() => {
                    if (menuItemEl.parentNode) {
                       menuItemEl.classList.remove('animate-in');
                    }
                    delete item.isNew;
                }, 700);
            }
            
            menuItemEl.addEventListener('dragstart', handleDragStart);
            menuItemEl.addEventListener('dragover', handleDragOver);
            menuItemEl.addEventListener('dragleave', handleDragLeave);
            menuItemEl.addEventListener('drop', handleDrop);
            menuItemEl.addEventListener('dragend', handleDragEnd);
            
            menuItemEl.querySelector('.lm-item-notes-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                menuItemEl.classList.toggle('notes-visible');
            });
            menuItemEl.querySelector('.lm-item-check-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleClearedState(index);
            });
            menuItemEl.addEventListener('click', (e) => {
                if(e.target.closest('button') || e.target.classList.contains('lm-item-drag-handle')) return;
                toggleClearedState(index);
            });

            const menuItemGridEl = menuItemEl.cloneNode(true);
            menuItemGridEl.querySelector('.lm-item-drag-handle').remove();
            menuItemGridEl.querySelector('.lm-item-delete').remove();
            
            menuItemGridEl.querySelector('.lm-item-notes-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                menuItemGridEl.classList.toggle('notes-visible');
            });
            menuItemGridEl.querySelector('.lm-item-check-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleClearedState(index);
            });
            menuItemGridEl.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                toggleClearedState(index);
            });

            fragmentFullscreen.appendChild(menuItemEl);
            fragmentGrid.appendChild(menuItemGridEl);
        });

        menuDisplayFullscreen.appendChild(fragmentFullscreen);
        menuDisplayGrid.appendChild(fragmentGrid);

        adjustMenuFontSize();
        calculateTotalTime();
    }
    
    function renderControlButtons() {
        activityButtonsContainer.innerHTML = '';
        PRESET_ACTIVITIES.forEach(activityName => {
            const wrapper = document.createElement('div');
            wrapper.className = 'lm-activity-item-wrapper';

            const topRow = document.createElement('div');
            topRow.className = 'lm-activity-item';

            const button = document.createElement('button');
            button.textContent = activityName;
            
            const timeInput = document.createElement('input');
            timeInput.type = 'text';
            timeInput.className = 'lm-time-input';
            timeInput.placeholder = 'Time?';

            const notesBtn = document.createElement('button');
            notesBtn.className = 'lm-notes-toggle-btn';
            notesBtn.innerHTML = '📝';
            notesBtn.title = 'Add/Edit Notes';

            const notesTextarea = document.createElement('textarea');
            notesTextarea.className = 'lm-notes-input hidden';
            notesTextarea.placeholder = `Notes for ${activityName}...`;
            
            notesBtn.addEventListener('click', () => {
                notesTextarea.classList.toggle('hidden');
                if(!notesTextarea.classList.contains('hidden')) {
                    notesTextarea.focus();
                }
            });

            button.addEventListener('click', () => {
                addActivity(activityName, timeInput.value, notesTextarea.value);
                timeInput.value = '';
                notesTextarea.value = '';
                notesTextarea.classList.add('hidden');
            });

            topRow.appendChild(button);
            topRow.appendChild(timeInput);
            topRow.appendChild(notesBtn);
            wrapper.appendChild(topRow);
            wrapper.appendChild(notesTextarea);
            activityButtonsContainer.appendChild(wrapper);
        });
    }

    function addActivity(text, time, notes) {
        if (!text || !text.trim()) return;
        currentMenuItems.push({
            text: text.trim(),
            time: time.trim() || null,
            notes: notes.trim() || null,
            isNew: true,
            cleared: false
        });
        renderMenu();
    }
    
    function handleDragStart(e) {
        draggedItem = e.target.closest('.lm-menu-item');
        e.dataTransfer.effectAllowed = 'move';
        if (e.target.classList.contains('lm-item-drag-handle')) {
             e.dataTransfer.setDragImage(draggedItem, 0, 0);
        }
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
    }

    function handleDragOver(e) {
        e.preventDefault();
        const targetItem = e.target.closest('.lm-menu-item');
        if (targetItem && targetItem !== draggedItem) {
            document.querySelectorAll('.lm-menu-item.drag-over').forEach(el => el.classList.remove('drag-over'));
            targetItem.classList.add('drag-over');
        }
    }
    
    function handleDragLeave(e) {
        const targetItem = e.target.closest('.lm-menu-item');
        if (targetItem) {
            targetItem.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const targetItem = e.target.closest('.lm-menu-item');
        if (draggedItem && targetItem && targetItem !== draggedItem) {
            const fromIndex = parseInt(draggedItem.dataset.index, 10);
            const toIndex = parseInt(targetItem.dataset.index, 10);
            const [movedItem] = currentMenuItems.splice(fromIndex, 1);
            currentMenuItems.splice(toIndex, 0, movedItem);
            renderMenu();
        }
    }

    function handleDragEnd(e) {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
        }
        document.querySelectorAll('.lm-menu-item.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedItem = null;
    }
    
    async function populateLoadSelect() {
        const menus = await getAllLessonMenus();
        const currentVal = loadSelect.value;
        loadSelect.innerHTML = '<option value="">-- New Menu --</option>';
        for (const name in menus) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            loadSelect.appendChild(option);
        }
        if (Object.keys(menus).includes(currentVal)) {
           loadSelect.value = currentVal;
        }
    }

    function loadMenu() {
        const menuName = loadSelect.value;
        if (!menuName) {
            currentMenuItems = [];
            menuNameInput.value = '';
            renderMenu();
            return;
        }
        getAllLessonMenus().then(menus => {
            if (menus[menuName]) {
                currentMenuItems = JSON.parse(JSON.stringify(menus[menuName])).map(item => ({
                    ...item,
                    cleared: item.cleared || false,
                    notes: item.notes || null
                }));
                menuNameInput.value = menuName;
                renderMenu();
            }
        });
    }

    async function saveMenu() {
        const menuName = menuNameInput.value.trim();
        if (!menuName) {
            alert('Please enter a name for the menu.');
            return;
        }
        if (currentMenuItems.length === 0) {
            alert('Please add at least one activity to the menu.');
            return;
        }
        
        try {
            const cleanMenu = currentMenuItems.map(({ isNew, ...item }) => item);
            await saveLessonMenu(menuName, cleanMenu);
            alert(`Menu "${menuName}" saved successfully!`);
            await populateLoadSelect();
            loadSelect.value = menuName;
        } catch(error) {
            alert(`Error saving menu: ${error.name}`);
        }
    }
    
    async function deleteMenu() {
        const menuName = loadSelect.value;
        if (!menuName) {
            alert('Select a saved menu to delete.');
            return;
        }
        if (confirm(`Are you sure you want to delete the menu "${menuName}"?`)) {
            await deleteLessonMenu(menuName);
            alert(`Menu "${menuName}" deleted.`);
            menuNameInput.value = '';
            currentMenuItems = [];
            await populateLoadSelect();
            loadMenu(); 
        }
    }
    
    async function exportMenus() {
        const allMenus = await getAllLessonMenus();
        if (Object.keys(allMenus).length === 0) {
            alert('No saved menus to export.');
            return;
        }
        const blob = new Blob([JSON.stringify(allMenus, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'don-lesson-menus.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    function importFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                await importLessonMenus(importedData);
                alert('Menus imported successfully!');
                await populateLoadSelect();
            } catch (error) {
                alert('Import failed. The file is not valid JSON.');
                console.error('Lesson Menu import error:', error);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // --- Event Listeners ---
    
    panelToggleBtn.addEventListener('click', () => {
        fullscreenView.classList.toggle('panel-collapsed');
        const isCollapsed = fullscreenView.classList.contains('panel-collapsed');
        panelToggleBtn.innerHTML = isCollapsed ? '»' : '«';
        panelToggleBtn.title = isCollapsed ? 'Show Panel' : 'Hide Panel';
    });
    
    customNotesToggle.addEventListener('click', () => {
        customNotesInput.classList.toggle('hidden');
        if(!customNotesInput.classList.contains('hidden')) {
            customNotesInput.focus();
        }
    });

    addCustomBtn.addEventListener('click', () => {
        addActivity(customActivityInput.value, customTimeInput.value, customNotesInput.value);
        customActivityInput.value = '';
        customTimeInput.value = '';
        customNotesInput.value = '';
        customNotesInput.classList.add('hidden');
    });
    
    loadSelect.addEventListener('change', loadMenu);
    saveBtn.addEventListener('click', saveMenu);
    deleteBtn.addEventListener('click', deleteMenu);
    exportBtn.addEventListener('click', exportMenus);
    importInput.addEventListener('change', importFile);
    
    window.addEventListener('resize', adjustMenuFontSize);

    const observer = new MutationObserver((mutationsList) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                adjustMenuFontSize();
                if(toolCard.classList.contains('fullscreen-mode')) {
                    fullscreenView.classList.remove('panel-collapsed');
                    panelToggleBtn.innerHTML = '«';
                }
            }
        }
    });
    observer.observe(toolCard, { attributes: true });

    // --- Initialization ---
    renderControlButtons();
    renderMenu();
    populateLoadSelect();
}