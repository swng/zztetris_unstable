const print = console.log;
const LS = localStorage;

function ctrlsPopup() {
	var p = window.open('controls.html', 'popup', 'width=1200,height=800');
	var reloading = false;
	setInterval(() => {
		// event onbeforeunload wont work and idk why so i gotta use this
		if (p.closed && !reloading) {
			location.reload();
			reloading = true;
		}
	}, 100);
}

Array.prototype.getRand = function () {
	return this[Math.floor(Math.random() * this.length)];
};
Array.prototype.shuffle = function () {
	return this.sort(() => Math.random() - 0.5);
};
var ctrl = {
	ArrowLeft: 'L',
	ArrowRight: 'R',
	ArrowDown: 'SD',
	Space: 'HD',
	ShiftLeft: 'HL',
	KeyZ: 'CW',
	KeyX: 'CCW',
	KeyC: 'R180',
	KeyR: 'RE',
	KeyT: 'UNDO',
	KeyY: 'REDO',
};
const color = {
	Z: '#F00',
	L: '#F80',
	O: '#FF0',
	S: '#0F0',
	I: '#0BF',
	J: '#05F',
	T: '#C3F',
	A: '#2A2A2A',
	X: '#999999',
};
var imgs = {
	grid: './grid.png',
	Z: './pieceSprite/z.png',
	L: './pieceSprite/l.png',
	O: './pieceSprite/o.png',
	S: './pieceSprite/s.png',
	I: './pieceSprite/i.png',
	J: './pieceSprite/j.png',
	T: './pieceSprite/t.png',
};
var cellSize = 20; // pixels
var boardSize = [10, 40];
var hiddenRows = 20; // starts from the top
var DAS = 160;
var ARR = 30;
var SDR = 15;

var ctrlsDat = LS.config;
if (ctrlsDat && LS.version == '2021-10-12a') {
	// Load saved config from LocalStorage
	var ctrls = JSON.parse(ctrlsDat);
	var codes = Object.values(ctrl);
	ctrl = {};
	for (let i = 0; i < 11; i++) {
		ctrl[ctrls[i]] = codes[i];
	}
	DAS = parseInt(ctrls[11]);
	ARR = parseInt(ctrls[12]);
	SDR = parseInt(ctrls[13]);
	cellSize = parseInt(ctrls[14]);
} else {
	// No config found or outdated version, make new
	var idk = Object.keys(ctrl);
	idk.push('160', '30', '15', '20');
	LS.config = JSON.stringify(idk);
}

const notf = $('#notif');
const names = 'ZLOSIJT'.split('');
const spawn = [Math.round(boardSize[0] / 2) - 2, hiddenRows - 3];
const a = { t: 0, c: '' }; // t:0 = nothing   t:1 = heap mino   t:2 = current mino   t:3 = ghost mino
const aRow = function () {
	return '.'
		.repeat(boardSize[0])
		.split('')
		.map(() => {
			return a;
		});
};
const rotDir = {
	CW: 1,
	CCW: 3,
	R180: 2,
};
var sfxCache = {};
var charging = false;
var board = [];
var queue = [];
var piece = '';
var holdP = '';
var held = false;
var Ldn = (Rdn = false);
var rot = 0;
var dasID = (sdID = 0);
var sdINT = (dasINT = null);
var xPOS = spawn[0];
var yPOS = spawn[1];
var xGHO = spawn[0];
var yGHO = spawn[1];
var lastAction = '';
var hist = [];
var histPos = 0;
var ctx = document.getElementById('b').getContext('2d');
var ctxH = document.getElementById('h').getContext('2d');
var ctxN = document.getElementById('n').getContext('2d');
var gridCvs = document.createElement('canvas');
gridCvs.height = cellSize;
gridCvs.width = cellSize;
var gridCtx = gridCvs.getContext('2d');
gridCtx.fillStyle = '#000000';
gridCtx.fillRect(0, 0, cellSize, cellSize);
gridCtx.strokeStyle = '#3A3A3A';
gridCtx.strokeRect(0, 0, cellSize, cellSize);
var pattern = ctx.createPattern(gridCvs, 'repeat');
for (let i = 0; i < boardSize[1]; i++) {
	board.push(aRow());
}
document.getElementById('b').height = (boardSize[1] - hiddenRows + 2) * cellSize;
document.getElementById('b').width = boardSize[0] * cellSize;

var keys = Object.keys(imgs);
keys.map((k, idx) => {
	var i = new Image();
	i.onload = () => {
		imgs[k] = i;
		if (idx + 1 == keys.length)
			setTimeout(() => {
				callback();
			}, 250); // Load images first, then load game after
	};
	i.src = imgs[k];
});

const keystrokes = {
    'last': '',
    'L': false,
    'R': false,
    'SD': false,
    'HD': false,
    'HL': false,
    'CW': false,
    'CCW': false,
    'R180': false,
    'RE': false,
    'UNDO': false,
    'REDO': false,
}

// mouse stuff for drawing

mouseY = 0; // which cell on the board the mouse is over
mouseX = 0;
mouseDown = false;
drawMode = true;
movingCoordinates = false;

document.getElementById('b').onmousemove = function mousemove(e) {
	rect = document.getElementById('b').getBoundingClientRect();
	y = Math.floor((e.clientY - rect.top - 18) / cellSize);
	x = Math.floor((e.clientX - rect.left - 18) / cellSize);

	if (inRange(x, 0, 9) && inRange(y, 0, 21)) {
		movingCoordinates = y != mouseY || x != mouseX;

		mouseY = y;
		mouseX = x;

		if (mouseDown && movingCoordinates) {
			if (!drawMode) {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 0, c: '' };
			} else {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 1, c: 'X' };
			}
			updateGhost();
		}
	}
};

document.getElementById('b').onmousedown = function mousedown(e) {
	rect = document.getElementById('b').getBoundingClientRect();
	mouseY = Math.floor((e.clientY - rect.top - 18) / cellSize);
	mouseX = Math.floor((e.clientX - rect.left - 18) / cellSize);

	if (inRange(mouseX, 0, 9) && inRange(mouseY, 0, 21)) {
		if (!mouseDown) {
			movingCoordinates = false;
			drawMode = board[boardSize[1] + mouseY - hiddenRows - 2][mouseX]['t'] == 1;
			if (drawMode) {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 0, c: '' };
			} else {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 1, c: 'X' };
			}
			updateGhost();
		}
		mouseDown = true;
		drawMode = board[boardSize[1] + mouseY - hiddenRows - 2][mouseX]['t'] == 1;
	}
};

document.onmouseup = function mouseup() {
	mouseDown = false;

	if (drawMode) {
		// compare board with hist[histPos]['board'] and attempt to autocolor
		drawn = [];
		oldBoard = hist[histPos]['board'];
		board.map((r, i) => {
			r.map((c, ii) => {
				if (c.c == 'X' && oldBoard[i][ii].c != 'X') drawn.push({ y: i, x: ii });
			});
		});
		if (drawn.length == 4) {
			// try to determine which tetramino was drawn
			// first entry should be the topleft one

			names.forEach((name) => {
				// jesus christ this is a large number of nested loops
				checkPiece = pieces[name];
				checkPiece.forEach((rot) => {
					for (y = 0; y <= 2; y++) {
						for (x = 0; x <= 2; x++) {
							matches = 0;
							for (row = 0; row < 4; row++) {
								for (col = 0; col < 4; col++) {
									if (rot[row][col] == 1) {
										checkY = row + drawn[0].y - y;
										checkX = col + drawn[0].x - x;
										drawn.forEach((coordinate) => {
											if (coordinate.x == checkX && coordinate.y == checkY) {
												matches++;
											}
										});
									}
								}
							}
							if (matches == 4) {
								// that's a match; color it
								drawn.forEach((coordinate) => {
									board[coordinate.y][coordinate.x].c = name;
								});
							}
						}
					}
				});
			});
		}
	}

	if (
		hist[histPos] !=
		{
			board: JSON.parse(JSON.stringify(board)),
			queue: JSON.parse(JSON.stringify(queue)),
			hold: holdP,
			piece: piece,
		}
	)
		updateHistory();
};

// import/export stuff

function exportFumen() {
	fumen = encode(board);
	console.log(fumen);
	navigator.clipboard.writeText(fumen);
	// window.open('https://harddrop.com/fumen/?' + fumen, '_blank');
}

async function importImage() {
	try {
		const clipboardItems = await navigator.clipboard.read();
		for (const clipboardItem of clipboardItems) {
			for (const type of clipboardItem.types) {
				const blob = await clipboardItem.getType(type);
				//console.log(URL.createObjectURL(blob));

				// Create an abstract canvas and get context
				var mycanvas = document.createElement('canvas');
				var ctx = mycanvas.getContext('2d');

				// Create an image
				var img = new Image();

				// Once the image loads, render the img on the canvas
				img.onload = function () {
					console.log(this.width, this.height);
					scale = this.width / 10.0;
					x = 10;
					y = Math.min(Math.round(this.height / scale), 20);
					console.log(x, y);
					mycanvas.width = x;
					mycanvas.height = y;

					// Draw the image
					ctx.drawImage(img, 0, 0, x, y);
					var data = Object.values(ctx.getImageData(0, 0, x, y).data);
					var nDat = [];
					for (let i = 0; i < data.length / 4; i++) {
						//nDat.push(data[i*4] + data[(i*4)+1] + data[(i*4)+2] < 382?1:0)
						var hsv = rgb2hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
						console.log(hsv, nearestColor(hsv[0], hsv[1], hsv[2])); // debugging purposes
						nDat.push(nearestColor(hsv[0], hsv[1], hsv[2]));
					}

					tempBoard = new Array(40 - y).fill(new Array(10).fill({ t: 0, c: '' })); // empty top [40-y] rows
					for (rowIndex = 0; rowIndex < y; rowIndex++) {
						let row = [];
						for (colIndex = 0; colIndex < 10; colIndex++) {
							index = rowIndex * 10 + colIndex;
							temp = nDat[index];
							if (temp == '.') row.push({ t: 0, c: '' });
							else row.push({ t: 1, c: temp });
						}
						tempBoard.push(row);
					}

					board = JSON.parse(JSON.stringify(tempBoard));

					xPOS = spawn[0];
					yPOS = spawn[1];
					rot = 0;
					clearActive();
					updateGhost();
					setShape();
					updateHistory();
				};

				var URLObj = window.URL || window.webkitURL;
				img.src = URLObj.createObjectURL(blob);
			}
		}
	} catch (err) {
		console.error(err.name, err.message);
	}
}

function rgb2hsv(r, g, b) {
	let v = Math.max(r, g, b),
		c = v - Math.min(r, g, b);
	let h = c && (v == r ? (g - b) / c : v == g ? 2 + (b - r) / c : 4 + (r - g) / c);
	return [60 * (h < 0 ? h + 6 : h), v && c / v, v];
}

function nearestColor(h, s, v) {
	if (inRange(h, 0, 30) && inRange(s, 0, 1) && (inRange(v, 133, 135) || inRange(v, 63, 88))) return 'X'; // attempted manual override specifically for four.lol idk
	if (inRange(h, 220, 225) && inRange(s, 0, 0.2) && v == 65) return '.';

	if (s <= 0.2 && v / 2.55 >= 55) return 'X';
	if (v / 2.55 <= 55) return '.';

	if (inRange(h, 0, 16) || inRange(h, 325, 360)) return 'Z';
	else if (inRange(h, 16, 37)) return 'L';
	else if (inRange(h, 37, 70)) return 'O';
	else if (inRange(h, 70, 149)) return 'S';
	else if (inRange(h, 149, 200)) return 'I';
	else if (inRange(h, 200, 266)) return 'J';
	else if (inRange(h, 266, 325)) return 'T';
	return '.';
}

function inRange(x, min, max) {
	return x >= min && x <= max;
}

async function importFumen() {
	fumen = await navigator.clipboard.readText();
	result = decode(fumen);
	board = JSON.parse(JSON.stringify(result));

	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	updateGhost();
	setShape();
	updateHistory();
}

function updateHistory() {
	histPos++;
	hist[histPos] = {
		board: JSON.parse(JSON.stringify(board)),
		queue: JSON.parse(JSON.stringify(queue)),
		hold: holdP,
		piece: piece,
	};
	if (histPos > 100) {
		histPos = 100;
		hist.shift();
	}
	while (histPos < hist.length - 1) {
		// remove future history if it exists
		hist.pop();
	}
}

function updateGhost() {
	// updateGhost() must ALWAYS be before setShape()
	xGHO = xPOS;
	yGHO = yPOS;
	while (canMove(pieces[piece][rot], xGHO, yGHO + 1)) {
		yGHO++;
	}
}

function canMove(p, x, y) {
	var free = 0;
	for (let row = 0; row < 4; row++) {
		for (let cell = 0; cell < 4; cell++) {
			if (p[row][cell] == 1) {
				if (board[y + row] && board[y + row][x + cell] && board[y + row][x + cell].t != 1) {
					free++;
				}
			}
		}
	}
	return free >= 4;
}

function checkTopOut() {
	p = pieces[piece][rot];
	for (r = 0; r < p.length; r++) {
		for (c = 0; c < p[0].length; c++) {
			if (p[r][c] != 0) {
				if (board[r + yPOS][c + xPOS].t != 0) {
					notify('TOP OUT');
				}
			}
		}
	}
}

function setShape(hd) {
	var p = pieces[piece][rot];
	p.map((r, i) => {
		r.map((c, ii) => {
			var rowG = board[i + yGHO];
			if (c == 1 && rowG && rowG[ii + xGHO]) rowG[ii + xGHO] = { t: 3, c: piece };
			var rowP = board[i + yPOS];
			if (c == 1 && rowP && rowP[ii + xPOS]) rowP[ii + xPOS] = { t: hd ? 1 : 2, c: piece };
		});
	});
	//render()
}

function clearActive() {
	board.map((r, i) => {
		r.map((c, ii) => {
			if (c.t == 2 || (c.t == 3 && board[i][ii])) {
				board[i][ii].t = 0;
				board[i][ii].c = '';
			}
		});
	});
}

function newPiece() {
	while (queue.length < 10) {
		var shuf = names.shuffle();
		shuf.map((p) => queue.push(p));
		queue.push('|');
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	if (queue[0] == '|') queue.shift();
	piece = queue.shift();
	checkTopOut();
	updateQueue();
	updateGhost();
	setShape();
}

function notify(text) {
	const inANIM = 'animate__animated animate__bounceIn';
	const outANIM = 'animate__animated animate__fadeOutDown';
	notf.removeClass(inANIM);
	notf.removeClass(outANIM);
	notf.html(text);
	notf.addClass(inANIM);
	setTimeout(() => {
		notf.removeClass(inANIM);
		notf.addClass(outANIM);
	}, 1000);
}

function updateQueue() {
	temp = false;
	ctxN.clearRect(0, 0, 90, 360);
	ctxH.clearRect(0, 0, 90, 60);
	for (let i = 0; i < 7; i++) {
		if (queue[i] == '|') {
			ctxN.beginPath();
			ctxN.moveTo(0, i * 60);
			ctxN.lineTo(90, i * 60);
			ctxN.stroke();
			temp = true;
		} else {
			j = i;
			if (temp) j--;
			ctxN.drawImage(imgs[queue[i]], 0, j * 60);
		}
	}
	if (holdP) ctxH.drawImage(imgs[holdP], 0, 0);
}

function shuffleQueue() {
	// locate bag separator
	index = 0;
	while (index < queue.length && queue[index] != '|') index++;

	tempQueue = queue.slice(0, index).concat(piece).shuffle().concat('|');
	// the queue before the bag separator (the current bag), plus active piece; shuffle it; add bag separator to end
	piece = tempQueue.shift();
	queue = tempQueue;

	while (queue.length < 10) {
		var shuf = names.shuffle();
		shuf.map((p) => queue.push(p));
		queue.push('|');
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	checkTopOut();
	updateQueue();
	updateGhost();
	setShape();
	updateHistory();
}

function shuffleQueuePlusHold() {
	if (!holdP) {
		shuffleQueue();
		return;
	}

	index = 0;
	while (index < queue.length && queue[index] != '|') index++;

	tempQueue = queue.slice(0, index).concat(piece, holdP).shuffle().concat('|');
	holdP = tempQueue.shift();
	piece = tempQueue.shift();
	queue = tempQueue;

	while (queue.length < 10) {
		var shuf = names.shuffle();
		shuf.map((p) => queue.push(p));
		queue.push('|');
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	checkTopOut();
	updateQueue();
	updateGhost();
	setShape();
	updateHistory();
}

function callback() {
	pieces = SRSX.pieces;
	kicks = SRSX.kicks;
	document.addEventListener('keydown', function (e) {
		//if (e.repeat) return;
        const input = ctrl[e.code];
        if (input) {
            keystrokes[input] = true;
            // keystrokes['last'] = input;
        }
        
        if (e.repeat) return;
		if (input) {
            switch (input) {
                /*
				case 'L':
					Ldn = true;
					dasID++;
					das('L', dasID);
					break;
				case 'R':
					Rdn = true;
					dasID++;
					das('R', dasID);
					break;
				case 'SD':
					sdID++;
					softDrop(sdID);
					break;
                */
				case 'HD':
					hardDrop();
					break;
				case 'HL':
					hold();
					break;
				case 'CW':
					rotate('CW');
					break;
				case 'CCW':
					rotate('CCW');
					break;
				case 'R180':
					rotate('R180');
					break;
				case 'RE': // Restart
					board = [];
					for (let i = 0; i < boardSize[1]; i++) {
						board.push(aRow());
					}
					queue = [];
					rot = 0;
					piece = '';
					holdP = '';
					held = false;
					xPOS = spawn[0];
					yPOS = spawn[1];
					xGHO = spawn[0];
					yGHO = spawn[1];
					newPiece();
					break;
				case 'UNDO':
					if (histPos > 0) {
						histPos--;
						board = JSON.parse(JSON.stringify(hist[histPos]['board']));
						queue = JSON.parse(JSON.stringify(hist[histPos]['queue']));
						holdP = hist[histPos]['hold'];
						piece = hist[histPos]['piece'];

						xPOS = spawn[0];
						yPOS = spawn[1];
						rot = 0;
						clearActive();
						updateGhost();
						setShape();
						updateQueue();
					}
					break;
				case 'REDO':
					if (histPos < hist.length - 1) {
						board = JSON.parse(JSON.stringify(hist[histPos + 1]['board']));
						queue = JSON.parse(JSON.stringify(hist[histPos + 1]['queue']));
						holdP = hist[histPos + 1]['hold'];
						piece = hist[histPos + 1]['piece'];
						histPos++;

						xPOS = spawn[0];
						yPOS = spawn[1];
						rot = 0;
						clearActive();
						updateGhost();
						setShape();
						updateQueue();
					}
			}
		}
        
	});
    
	document.addEventListener('keyup', function (e) {
        const input = ctrl[e.code];
        if (input) keystrokes[input] = false;
        
		if (input) {
			switch (input) {
				case 'SD':
                    sdID++;
                    if (keystrokes['last'] == 'SD') keystrokes['last'] = '';
					break;
				case 'L':
					//Ldn = false;
					dasID++;
					if (keystrokes['R'] && !charging) {
						das('R', dasID);
                    }
                    if (keystrokes['last'] == 'L') keystrokes['last'] = '';
					break;
				case 'R':
					//Rdn = false;
					dasID++;
					if (keystrokes['L'] && !charging) {
						das('L', dasID);
                    }
                    if (keystrokes['last'] == 'R') keystrokes['last'] = '';
					break;
			}
        }
        
	});

	newPiece();
	hist = [
		{
			board: JSON.parse(JSON.stringify(board)),
			queue: JSON.parse(JSON.stringify(queue)),
			hold: holdP,
			piece: piece,
		},
	];
	histPos = 0;
	setInterval(() => {
		move('SD');
	}, 700);

	function playSnd(sfx, overlap) {
		if (sfxCache[sfx] && !overlap) return sfxCache[sfx].play();
		var s = new Audio(`sfx/${sfx}.wav`);
		sfxCache[sfx] = s;
		s.play();
	}

	function move(dir) {
		switch (dir) {
			case 'L':
				if (canMove(pieces[piece][rot], xPOS - 1, yPOS)) {
					xPOS--;
					updateGhost();
					playSnd('Move');
					lastAction = 'L';
				}
				break;
			case 'R':
				if (canMove(pieces[piece][rot], xPOS + 1, yPOS)) {
					xPOS++;
					updateGhost();
					playSnd('Move');
					lastAction = 'R';
				}
				break;
			case 'SD':
				if (canMove(pieces[piece][rot], xPOS, yPOS + 1)) {
					yPOS++;
					lastAction = 'SD';
				}
				break;
		}
		clearActive();
		setShape();
	}

	function rotate(dir) {
		var newRot = (rot + rotDir[dir]) % 4;

		for (const kick of kicks[`${piece == 'I' ? 'I' : 'N'}${rot}-${newRot}`]) {
			if (canMove(pieces[piece][newRot], xPOS + kick[0], yPOS - kick[1])) {
				// Y is inverted lol
				xPOS += kick[0];
				yPOS -= kick[1];
				rot = newRot;
				playSnd('Rotate', true);
				lastAction = 'ROT';
				break;
			}
		}

		clearActive();
		updateGhost();
		setShape();
	}

	function das(dir, id) {
		move(dir);
		charging = true;
		setTimeout(() => {
			charging = false;
			for (let i = 0; i < (ARR == 0 ? boardSize[0] : 1); i++) {
				var looooop = setInterval(function () {
					if (dasID == id) {
						move(dir);
					} else {
						clearInterval(looooop);
					}
				}, ARR);
			}
		}, DAS);
	}

	function softDrop(id) {
		if (SDR) {
			var loop = setInterval(function (a) {
				if (sdID == id) {
					move('SD');
				} else {
					clearInterval(loop);
				}
			}, SDR);
		} else {
			// SDR is 0ms = instant SD
			var loop = setInterval(() => {
				if (sdID == id) {
					yPOS = yGHO;
					clearActive();
					setShape();
				} else {
					clearInterval(loop);
				}
			}, 0);
		}
	}

	function hardDrop() {
		yPOS = yGHO;
		held = false;
		playSnd('HardDrop', true);
		setShape(true);
		clearActive();
		checkLines();
		newPiece();

		lastAction = 'HD';

		updateHistory();
	}

	function hold() {
		//if(held) return;
		rot = 0;
		xPOS = spawn[0];
		yPOS = spawn[1];
		held = true;
		if (holdP) {
			holdP = [piece, (piece = holdP)][0];
		} else {
			holdP = piece;
			piece = queue.shift();
		}
		playSnd('Hold');
		clearActive();
		checkTopOut();
		updateGhost();
		setShape();
		updateQueue();
		lastAction = 'HOLD';
	}

	function checkLines() {
		tspin = false;
		mini = false;
		pc = false;
		if (piece == 'T' && lastAction == 'ROT') {
			corners = [
				[yPOS + 1, xPOS],
				[yPOS + 1, xPOS + 2],
				[yPOS + 3, xPOS + 2],
				[yPOS + 3, xPOS],
			];
			facingCorners = [corners[rot], corners[(rot + 1) % 4]];

			filledCorners = 0;
			corners.forEach((corner) => {
				if (corner[0] >= 40 || corner[1] < 0 || corner[1] >= 10) filledCorners++;
				else if (board[corner[0]][corner[1]]['t'] == 1) filledCorners++;
			});
			tspin = filledCorners >= 3;

			if (tspin) {
				filledFacingCorners = 0;
				facingCorners.forEach((corner) => {
					if (corner[0] >= 40 || corner[1] < 0 || corner[1] >= 10) FilledFacingCorners++;
					else if (board[corner[0]][corner[1]]['t'] == 1) filledFacingCorners++;
				});
				mini = filledFacingCorners < 2; // no I'm not adding the "TST Kick and Fin Kick" exceptions. STSDs and Fins deserve to be mini
			}
		}

		if (board[board.length - 1].filter((c) => c.t == 0).length == boardSize[0]) pc = true;

		board = board.filter(
			(r) =>
				!r
					.map((c) => {
						return c.t == 1;
					})
					.every((v) => v)
		);
		var l = board.length;
		var cleared = 0;
		for (let i = 0; i < boardSize[1] - l; i++) {
			cleared++;
			board.unshift(aRow());
		}

		text = '';
		if (mini) text += 'MINI ';
		if (tspin) text += 'T-SPIN ';
		if (cleared > 4) cleared = 4; // nani
		if (cleared > 0) text += ['NULL', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][cleared];
		if (pc) text = 'PERFECT\nCLEAR!';

		if (text != '') notify(text);
		if (tspin || cleared == 4) playSnd('ClearTetra', true);
		if (pc) playSnd('PerfectClear', 1);
	}

	function drawCell(x, y, piece, type) {
		if (type == 3) {
			// Ghost
			ctx.strokeStyle = '#CCC';
			ctx.strokeRect((x - 1) * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
		} else if (type !== 0) {
			// Current and Heap
			ctx.fillStyle = color[piece];
			ctx.fillRect((x - 1) * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
		}
	}

    function render() {
        if (keystrokes['L'] && keystrokes['R']) {
            if (keystrokes['last'] == 'L') {
                dasID++;
                das('L', dasID);
                keystrokes['last'] = 'L';
            }
            if (keystrokes['last'] == 'R') {
                dasID++;
                das('R', dasID);
                keystrokes['last'] = 'R';
            }
        }
        else {
            if (keystrokes['L'] && keystrokes['last'] != 'L') {
                dasID++;
                das('L', dasID);
                keystrokes['last'] = 'L';
            }
            if (keystrokes['R'] && keystrokes['last'] != 'R') {
                dasID++;
                das('R', dasID);
                keystrokes['last'] = 'R';
            }
        }
        if (keystrokes['SD'] && keystrokes['last'] != 'SD') {
            console.log("hi")
            sdID++;
            softDrop(sdID);
            keystrokes['last'] = 'SD';
        }

		ctx.clearRect(0, 0, boardSize[0] * cellSize, boardSize[1] * cellSize);
		ctx.fillStyle = pattern;
		ctx.fillRect(0, 0, boardSize[0] * cellSize, boardSize[1] * cellSize);

		board.map((y, i) => {
			y.map((x, ii) => {
				if (x.t !== 0) {
					drawCell(ii + 1, i - hiddenRows + 2, x.c, x.t);
				} else if (i <= spawn[1] + 2) {
					// render the top 2 rows as grey
					drawCell(ii + 1, i - hiddenRows + 2, 'A', 1);
				}
			});
        });
        window.requestAnimationFrame(render);
	}
    /*
	setInterval(() => {
		render();
	}, 0);
    */
    window.requestAnimationFrame(render);
}
