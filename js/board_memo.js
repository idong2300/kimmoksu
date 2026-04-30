    let noticeSortable = null;
    let memoSortable = null;
    let noticeUnsubscribe = null;
    let boardMemoUnsubscribe = null;
    let cachedNotices = [];
    let cachedBoardMemos = [];


function canUseIntegratedEditMode() {
        return myRole === 'owner' || myRole === 'admin' || globalStatusAdmins.includes(myEmail) || globalNoticeAdmins.includes(myEmail);
    }

    function canEditBoardItems() {
        return myRole === 'owner' || myRole === 'admin' || globalNoticeAdmins.includes(myEmail) || globalStatusAdmins.includes(myEmail);
    }

    function loadBoardMemos() {
        if(!myTeamId) return;

        if(noticeUnsubscribe) noticeUnsubscribe();
        if(boardMemoUnsubscribe) boardMemoUnsubscribe();

        noticeUnsubscribe = db.collection("notices").where("teamId", "==", myTeamId).orderBy("createdAt", "desc").onSnapshot(ss => {
            cachedNotices = ss.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dateStr: new Date(doc.data().createdAt || Date.now()).toLocaleDateString().slice(5)
            })).sort((a,b) => (a.order !== undefined && b.order !== undefined) ? a.order - b.order : (b.createdAt || 0) - (a.createdAt || 0));
            renderBoardMemos();
        });

        boardMemoUnsubscribe = db.collection("board_memos").where("teamId", "==", myTeamId).where("type", "==", "memo").orderBy("createdAt", "desc").onSnapshot(ss => {
            cachedBoardMemos = ss.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a,b) => (a.order !== undefined && b.order !== undefined) ? a.order - b.order : (b.createdAt || 0) - (a.createdAt || 0));
            renderBoardMemos();
        });
    }

    function renderBoardMemos() {
        const homeNotice = document.getElementById('home-notice-list');
        const manageNotice = document.getElementById('manage-notice-list');
        const homeMsg = document.getElementById('home-msg-list');
        const manageMemo = document.getElementById('manage-memo-list');
        if(!homeNotice || !manageNotice || !homeMsg || !manageMemo) return;

        const boardEditEnabled = isStatusEditMode && canEditBoardItems();
        const dragHandle = boardEditEnabled ? `<i class="bi bi-grip-vertical drag-handle me-2"></i>` : '';

        homeNotice.innerHTML = cachedNotices.slice(0,5).map(n => `<div class="mb-1 text-truncate">• ${n.text}</div>`).join('') || '내용 없음';
        manageNotice.innerHTML = cachedNotices.map(n =>
            `<div class="board-item d-flex justify-content-between align-items-center" data-id="${n.id}">
                <div class="d-flex align-items-center flex-grow-1 overflow-hidden pe-2" style="min-width: 0;">
                    ${dragHandle}
                    <div class="flex-grow-1 text-truncate pe-2" style="min-width: 0;">${n.text} <span class="small text-secondary ms-2">${n.dateStr || ''}</span></div>
                </div>
                ${boardEditEnabled ? `<div class="flex-shrink-0"><button class="btn btn-sm text-danger p-0 ms-2" onclick="delOldNotice('${n.id}')"><i class="bi bi-trash"></i></button></div>` : ''}
            </div>`
        ).join('');

        homeMsg.innerHTML = cachedBoardMemos.slice(0,5).map(n => `<div class="mb-1 text-truncate">• ${n.text}</div>`).join('') || '내용 없음';
        manageMemo.innerHTML = cachedBoardMemos.map(n =>
            `<div class="board-item d-flex justify-content-between align-items-center" style="border-color:var(--success-btn);" data-id="${n.id}">
                <div class="d-flex align-items-center flex-grow-1 overflow-hidden pe-2" style="min-width: 0;">
                    ${dragHandle}
                    <div class="flex-grow-1 text-truncate pe-2" style="min-width: 0;">${n.text} <span class="small text-secondary ms-2">${n.dateStr || ''}</span></div>
                </div>
                ${boardEditEnabled ? `<div class="flex-shrink-0"><button class="btn btn-sm text-danger p-0 ms-2" onclick="delBoardItem('${n.id}')"><i class="bi bi-trash"></i></button></div>` : ''}
            </div>`
        ).join('');

        initBoardSortables(boardEditEnabled);
    }

    function initBoardSortables(enable) {
        if(noticeSortable) { try { noticeSortable.destroy(); } catch(e) {} noticeSortable = null; }
        if(memoSortable) { try { memoSortable.destroy(); } catch(e) {} memoSortable = null; }
        if(!enable) return;

        const noticeList = document.getElementById('manage-notice-list');
        const memoList = document.getElementById('manage-memo-list');

        if(noticeList) {
            noticeSortable = Sortable.create(noticeList, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: async function() {
                    const items = document.querySelectorAll('#manage-notice-list .board-item');
                    const batch = db.batch();
                    items.forEach((el, idx) => batch.update(db.collection("notices").doc(el.getAttribute('data-id')), { order: idx }));
                    await batch.commit();
                }
            });
        }

        if(memoList) {
            memoSortable = Sortable.create(memoList, {
                handle: '.drag-handle',
                animation: 150,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                onEnd: async function() {
                    const items = document.querySelectorAll('#manage-memo-list .board-item');
                    const batch = db.batch();
                    items.forEach((el, idx) => batch.update(db.collection("board_memos").doc(el.getAttribute('data-id')), { order: idx }));
                    await batch.commit();
                }
            });
        }
    }

    async function addBoardItem(type) {
        let input = document.getElementById(`input-${type}`); let text = input.value.trim(); if(!text) return;
        if(type === 'notice') { await db.collection("notices").add({ teamId: myTeamId, text: text, writer: userNickname, createdAt: Date.now(), order: Date.now() }); } 
        else { let today = new Date(); let dStr = `0${today.getMonth()+1}`.slice(-2)+"."+`0${today.getDate()}`.slice(-2); await db.collection("board_memos").add({ teamId: myTeamId, type: type, text: text, dateStr: dStr, createdAt: Date.now(), order: Date.now() }); }
        input.value = '';
    }
    async function delOldNotice(id) { if(confirm("삭제하시겠습니까?")) await db.collection("notices").doc(id).delete(); }
    async function delBoardItem(id) { if(confirm("삭제하시겠습니까?")) await db.collection("board_memos").doc(id).delete(); }

window.canUseIntegratedEditMode = canUseIntegratedEditMode;
window.canEditBoardItems = canEditBoardItems;
window.loadBoardMemos = loadBoardMemos;
window.renderBoardMemos = renderBoardMemos;
window.initBoardSortables = initBoardSortables;
window.addBoardItem = addBoardItem;
window.delOldNotice = delOldNotice;
window.delBoardItem = delBoardItem;
