// Heuristic evaluation function
function evaluateBoard(board) {
    let aggregateHeight = 0;
    let completeLines = 0;
    let holes = 0;
    let bumpiness = 0;
    let columnHeights = new Array(nx).fill(0);
    // Calculate aggregate height and column heights
    for (let x = 0; x < nx; x++) {
        for (let y = 0; y < ny; y++) {
            if (board[x][y] !== 0 && board[x][y] != null) {
                columnHeights[x] = ny - y;
                aggregateHeight += columnHeights[x];
                break;
            }
        }
    }

    // Calculate complete lines
    for (let y = 0; y < ny; y++) {
        var complete = true;
        for (let x = 0; x < nx; x++) {
            if (board[x][y] === 0 || board[x][y] == null) {
                complete = false;
                break;
            }
        }
        if (complete)
            completeLines++;
    }

    // Calculate holes
    for (let x = 0; x < nx; x++) {
        let blockFound = false;
        for (let y = 0; y < ny; y++) {
            if (board[x][y] !== 0 && board[x][y] != null) {
                blockFound = true;
            } else if (blockFound && (board[x][y] === 0 || board[x][y] == null)) {
                holes++;
            }
        }
    }

    // Calculate bumpiness
    for (let x = 0; x < nx - 1; x++) {
        bumpiness += Math.abs(columnHeights[x] - columnHeights[x + 1]);
    }
    // Combine features into a heuristic score
    return -0.51 * aggregateHeight + 0.75 * completeLines - 0.36 * holes - 0.17 * bumpiness;
}

// Function to deep copy the blocks array
function copyBlocks(blocks) {
    let new_blocks = [];
    for (let x = 0; x < nx; x++) {
        new_blocks[x] = [];
        for (let y = 0; y < ny; y++) {
            new_blocks[x][y] = blocks[x][y];
        }
    }
    return new_blocks;
}

// Generate all possible moves for the current piece
function getPossibleMoves(piece) {
    let moves = [];
    let posX = piece.x;
    let posY = piece.y;
    // For each rotation of the piece
    for (let dir = 0; dir < 4; dir++) {
        piece.dir = dir;
        // For each horizontal position (reachable from here - restriction on y)
        for (let x = posX; x >= -piece.type.size + 1; x--) {
            let y = getDropPosition(piece, x);
            if(y < posY){
                break;
            }
            let new_blocks = copyBlocks(blocks);
            eachblock(piece.type, x, y, piece.dir, function(x, y) {
                new_blocks[x][y] = piece.type;
            });
            moves.push({piece: {...piece}, x: x, y: y, board: new_blocks});
        }
        for (let x = posX; x < nx; x++) {
            let y = getDropPosition(piece, x);
            if(y < posY){
                break;
            }
            let new_blocks = copyBlocks(blocks);
            eachblock(piece.type, x, y, piece.dir, function(x, y) {
                new_blocks[x][y] = piece.type;
            });
            moves.push({piece: {...piece}, x: x, y: y, board: new_blocks});
        }
    }
    return moves;
}

// Select the best move based on heuristic evaluation
function selectBestMove(piece, board) {
    let moves = getPossibleMoves(piece);
    let bestMove = null;
    let bestScore = -Infinity;
    moves.forEach(move => {
        let score = evaluateBoard(move.board);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    });
    return bestMove;
}

// Function to get the drop position of the piece
function getDropPosition(piece, x) {
    let y = -1;
    while (!occupied(piece.type, x, y + 1, piece.dir)) {
        y++;
    }
    return y;
}

// ----------------------
// BEAM SEARCH          |
// ----------------------

// Select the best move based on heuristic evaluation
function selectBestMoveBeam(piece, nextPiece, board, beamWidth=5, maxTreeDepth=5) {
    bestMove = beamSearch(piece, beamWidth, maxTreeDepth, board, nextPiece)
    return bestMove;
}

function beamSearch(piece, beamWidth, maxTreeDepth, curBoard, nextPiece) {
    // in this piece of ... (js) I didn't manage to nake the heap work;
    // similar problem with separation into files - idk why for this one it works
    // assuming that beamWidth not more than 20, number of insertions (better scores) is not too big
    // I would store the array of elements with max scores in arbitrary order,
    // index of minimum of the array, min element (score)
    let pq = [];
    let minIndex = -1;
    let minMaxElement = Infinity;

    let moves = getPossibleMovesBeam(piece, curBoard);
    moves.forEach(move => {
        let newBoard = move.board; 
        let score = evaluateBoard(newBoard);
        if(pq.length < beamWidth){
            pq.push({board: newBoard, firstMove: move, priority: score});
            if (score < minMaxElement) {
                minMaxElement = score;
                minIndex = pq.length - 1;
            }
        } else if (score > minMaxElement){
            pq[minIndex] = {board: newBoard, firstMove: move, priority: score};
            minMaxElement = Infinity;
            for (let i = 0; i < beamWidth; i++){
                if (pq[i].priority < minMaxElement){
                    minIndex = i;
                    minMaxElement = pq[i].priority;
                }
            }
        }
    });

    let curPieces = [nextPiece];
    while(--maxTreeDepth){
        let pq1 = [];
        let minIndex = -1;
        let minMaxElement = Infinity;
        pq.forEach(item => {
            let parentScore = item.priority;
            for (let piece of curPieces){ 
                let nextMoves = getPossibleMovesBeam(piece, removeFullLinesBeam(item.board));
                nextMoves.forEach(move => {
                    let newBoard = move.board;
                    let score = evaluateBoard(newBoard) + parentScore;
                    if(pq1.length < beamWidth){
                        pq1.push({board: newBoard, firstMove: item.firstMove, priority: score});
                        if (score < minMaxElement) {
                            minMaxElement = score;
                            minIndex = pq1.length - 1;
                        }
                    } else if (score > minMaxElement){
                        pq1[minIndex] = {board: newBoard, firstMove: item.firstMove, priority: score};
                        minMaxElement = Infinity;
                        for (let i = 0; i < beamWidth; i++){
                            if (pq1[i].priority < minMaxElement){
                                minIndex = i;
                                minMaxElement = pq1[i].priority;
                            }
                        }
                    }

                });
            }   
        });
        // avoid empty pq
        if(pq1.length === 0) break;
        pq = pq1;
        curPieces = [i, j, l, o, s, t, z].map(ch => ({x: 0, y: 0, dir: 0, type: ch }));
    }

    let best = pq.sort((a,b) => b.priority - a.priority)[0];
    return best.firstMove;
}

function removeFullLinesBeam(board) {
    let newBoard = board.map(col => col.slice()); 
    for (let y = ny - 1; y >= 0; y--) {
        let full = true;
        for (let x = 0; x < nx; x++) {
            if (!newBoard[x][y]) {
                full = false;
                break;
            }
        }
        if (full) {
            for (let yy = y; yy > 0; yy--) {
                for (let x = 0; x < nx; x++) {
                    newBoard[x][yy] = newBoard[x][yy - 1];
                }
            }
            for (let x = 0; x < nx; x++) newBoard[x][0] = null;
            y++;
        }
    }
    return newBoard;
}

// Generate all possible moves for the current piece on a given board
function getPossibleMovesBeam(piece, board) {
    let moves = [];
    let posX = piece.x;
    let posY = piece.y;

    for (let dir = 0; dir < 4; dir++) {
        piece.dir = dir;

        for (let x = posX; x >= -piece.type.size + 1; x--) {
            let y = getDropPositionBeam(piece, x, board);
            if (y < posY) break;

            let newBoard = copyBlocks(board);
            eachblock(piece.type, x, y, piece.dir, function(px, py) {
                if (px >= 0 && px < nx && py >= 0 && py < ny)
                    newBoard[px][py] = piece.type; 
            });
            moves.push({piece: {...piece}, x, y, board: newBoard});
        }

        for (let x = posX; x < nx; x++) {
            let y = getDropPositionBeam(piece, x, board);
            if (y < posY) break;

            let newBoard = copyBlocks(board);
            eachblock(piece.type, x, y, piece.dir, function(px, py) {
                if (px >= 0 && px < nx && py >= 0 && py < ny)
                    newBoard[px][py] = piece.type;
            });
            moves.push({piece: {...piece}, x, y, board: newBoard});
        }
    }
    return moves;
}

function getDropPositionBeam(piece, x, board) {
    let y = -1;
    while (!occupiedBeam(piece.type, x, y + 1, piece.dir, board)) {
        y++;
    }
    return y;
}

function occupiedBeam(type, x, y, dir, board) {
    let result = false;
    eachblock(type, x, y, dir, (px, py) => {
        if (px < 0 || px >= nx || py < 0 || py >= ny || board[px][py])
            result = true;
    });
    return result;
}