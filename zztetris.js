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
const reversed = {
	Z: 'S',
	L: 'J',
	O: 'O',
	S: 'Z',
	I: 'I',
	J: 'L',
	T: 'T',
	A: 'A',
	X: 'X',
	'|': '|',
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
	aboutPopup();
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
var charged = false;
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

xblast = {
	minos: [],
	originality: 0,
	speed: 0,
	sources: {
		columns: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		types: {
			single: 4,
			double: 4,
			triple: 4,
			quad: 4,
			ts: 4,
			tsm: 4,
			tss: 4,
			tssm: 4,
			tsd: 4,
			tsdm: 4,
			tst: 4,
		},
	},
};

// Keys
var keysDown;
var lastKeys;

var flags = {
	HD: 1,
	R: 2,
	L: 4,
	SD: 8,
	HL: 16,
	CW: 32,
	CCW: 64,
	R180: 128,
	UNDO: 256,
	REDO: 512,
	RE: 1024,
};

var shiftDir = 0;
var shiftReleased = true;
var shiftDelay;
var arrDelay;

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
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 1, c: paintbucketColor() };
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
			drawMode = e.button != 0 || board[boardSize[1] + mouseY - hiddenRows - 2][mouseX]['t'] == 1;
			if (drawMode) {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 0, c: '' };
			} else {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 1, c: paintbucketColor() };
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
		erased = [];
		oldBoard = JSON.parse(hist[histPos]['board']);
		board.map((r, i) => {
			r.map((c, ii) => {
				if (c.t == 1 && c.c != oldBoard[i][ii].c) drawn.push({ y: i, x: ii });
				if (c.t == 0 && 1 == oldBoard[i][ii].t) erased.push({ y: i, x: ii });
			});
		});
		if (drawn.length == 4 && document.getElementById('autocolor').checked) {
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
		if (drawn.length != 0 || erased.length != 0) updateHistory();
	}
};

function paintbucketColor() {
	for (i = 0; i < document.paintbucket.length; i++) {
		if (document.paintbucket[i].checked) {
			return document.paintbucket[i].id;
		}
	}
}

document.getElementById('n').addEventListener('click', (event) => {
	let QueueInput = prompt('Queue', piece + queue.join('')).toUpperCase();
	// ok there's probably a regex way to do this but...
	temp = [];
	for (i = 0; i < QueueInput.length; i++) {
		//sanitization
		if ('SZLJIOT'.includes(QueueInput[i])) temp.push(QueueInput[i]);
	}
	if (temp.length > 0) {
		temp.push('|'); // could probably insert one every 7 pieces but am too lazy
		queue = temp;
		newPiece();
	}
});

document.getElementById('h').addEventListener('click', (event) => {
	let HoldInput = prompt('Hold', holdP).toUpperCase();
	if (HoldInput.length == 0) {
		holdP = '';
		updateQueue();
		return;
	}
	HoldInput = HoldInput[0]; // make sure it's just 1 character
	//sanitization
	if ('SZLJIOT'.includes(HoldInput)) {
		holdP = HoldInput;
		updateQueue();
	}
});

const ua = navigator.userAgent;
if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
	console.log('why do you even have a tablet');
	document.getElementById('tcc').style.display = 'inline-block';
} else if (
	/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)
) {
	console.log('mobile is bad and you should feel bad');
	document.getElementById('tcc').style.display = 'inline-block';
} // else document.getElementById("tcc").style.display = 'none';

// import/export stuff

async function importTetrio() {
	try {
		temp = await navigator.clipboard.readText();
	} catch (error) {
		temp = prompt('tetrio map');
	}
	convert = {
		'#': 'G',
		z: 'Z',
		s: 'S',
		l: 'L',
		j: 'J',
		t: 'T',
		i: 'I',
		o: 'O',
	};
	temp2 = temp.split('?');
	if (temp2[0].length != 400) {
		console.log('bad input');
		return;
	} // bad input
	if (temp2.length > 2) holdP = temp2[2];
	if (temp2.length > 1) {
		temp3 = temp2[1].split('');
		for (i = 0; i < temp3.length; i++) {
			temp3[i] = convert[temp3[i]];
		}
		queue = temp3;
	}
	//board
	for (i = 0; i < 400; i++) {
		temp4 = temp2[0][i];
		if (temp4 == '_') board[Math.floor(i / 10)][i % 10] = { t: 0, c: '' };
		else board[Math.floor(i / 10)][i % 10] = { t: 1, c: convert[temp4] };
	}
	console.log('hi');

	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	updateGhost();
	setShape();
	updateHistory();
}

function exportTetrio() {
	convert = {
		X: '#',
		Z: 'z',
		S: 's',
		L: 'l',
		J: 'j',
		T: 't',
		I: 'i',
		O: 'o',
	};
	result = '';
	for (row = 0; row < board.length; row++) {
		for (col = 0; col < board[0].length; col++) {
			if (board[row][col].t == 1) {
				result += convert[board[row][col].c];
			} else result += '_';
		}
	}
	result += '?' + convert[piece];
	for (i = 0; i < queue.length; i++) {
		if (queue[i] != '|') result += convert[queue[i]];
	}
	if (holdP) result += '?' + convert[holdP];

	console.log(result);
	try {
		navigator.clipboard.writeText(result);
	} catch (error) {
		window.alert(result);
	}
}

async function exportFumen() {
	fumen = encode(board);
	console.log(fumen);
	await navigator.clipboard.writeText(fumen);
	window.open('https://swng.github.io/fumen/?' + fumen, '_blank');
}

async function exportFullFumen() {
	fumen = fullEncode(hist);
	console.log(fumen);
	await navigator.clipboard.writeText(fumen);
	window.open('https://swng.github.io/fumen/?' + fumen, '_blank');
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
					y = Math.min(Math.round(this.height / scale), 22);
					console.log(x, y);
					mycanvas.width = this.width;
					mycanvas.height = this.height;

					// Draw the image
					ctx.drawImage(img, 0, 0, this.width, this.height);
					var data = Object.values(ctx.getImageData(0, 0, this.width, this.height).data);
					var nDat = [];
					for (row = 0; row < y; row++) {
						for (col = 0; col < 10; col++) {
							// get median value of pixels that should correspond to [row col] mino

							minoPixelsR = [];
							minoPixelsG = [];
							minoPixelsB = [];

							for (pixelRow = Math.floor(row * scale); pixelRow < row * scale + scale; pixelRow++) {
								for (pixelCol = Math.floor(col * scale); pixelCol < col * scale + scale; pixelCol++) {
									index = (pixelRow * this.width + pixelCol) * 4;
									minoPixelsR.push(data[index]);
									minoPixelsG.push(data[index + 1]);
									minoPixelsB.push(data[index + 2]);
								}
							}

							medianR = median(minoPixelsR);
							medianG = median(minoPixelsG);
							medianB = median(minoPixelsB);
							var hsv = rgb2hsv(medianR, medianG, medianB);
							console.log(hsv, nearestColor(hsv[0], hsv[1], hsv[2])); // debugging purposes
							nDat.push(nearestColor(hsv[0], hsv[1], hsv[2]));
						}
					}
					/* // old alg from just scaling it down to x by y pixels
                    for (let i = 0; i < data.length / 4; i++) {
						//nDat.push(data[i*4] + data[(i*4)+1] + data[(i*4)+2] < 382?1:0)
						var hsv = rgb2hsv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
						console.log(hsv, nearestColor(hsv[0], hsv[1], hsv[2])); // debugging purposes
						nDat.push(nearestColor(hsv[0], hsv[1], hsv[2]));
					}*/

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
	else if (inRange(h, 16, 41)) return 'L';
	else if (inRange(h, 41, 70)) return 'O';
	else if (inRange(h, 70, 149)) return 'S';
	else if (inRange(h, 149, 200)) return 'I';
	else if (inRange(h, 200, 266)) return 'J';
	else if (inRange(h, 266, 325)) return 'T';
	return '.';
}

function inRange(x, min, max) {
	return x >= min && x <= max;
}

function median(values) {
	// if this is too computationally expensive maybe switch to mean
	if (values.length === 0) throw new Error('No inputs');

	values.sort(function (a, b) {
		return a - b;
	});

	var half = Math.floor(values.length / 2);

	if (values.length % 2) return values[half];

	return (values[half - 1] + values[half]) / 2.0;
}

async function importFumen() {
	try {
		fumen = await navigator.clipboard.readText();
	} catch (error) {
		fumen = prompt('fumen encoding');
	}
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

async function importFullFumen() {
	try {
		fumen = await navigator.clipboard.readText();
	} catch (error) {
		fumen = prompt('fumen encoding');
	}
	result = fullDecode(fumen, hist[histPos]); // let's import boards but just keep current queue/hold/piece in each frame
	hist = JSON.parse(JSON.stringify(result));
	histPos = 0;
	board = JSON.parse(hist[0]['board']);
	queue = JSON.parse(hist[0]['queue']);
	holdP = hist[0]['hold'];
	piece = hist[0]['piece'];
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	updateGhost();
	setShape();
	updateQueue();
}

function mirror() {
	for (row = 0; row < board.length; row++) {
		board[row].reverse();
		for (i = 0; i < board[row].length; i++) {
			if (board[row][i].t == 1) board[row][i].c = reversed[board[row][i].c];
		}
	}
	for (i = 0; i < queue.length; i++) {
		queue[i] = reversed[queue[i]];
	}
	holdP = reversed[holdP];
	piece = reversed[piece];

	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	updateGhost();
	updateQueue();
	setShape();
	updateHistory();
}

function fullMirror() {
	for (i = 0; i < hist.length; i++) {
		tempBoard = JSON.parse(hist[i]['board']);
		for (row = 0; row < tempBoard.length; row++) {
			tempBoard[row].reverse();
			for (j = 0; j < tempBoard[row].length; j++) {
				if (tempBoard[row][j].t == 1) tempBoard[row][j].c = reversed[tempBoard[row][j].c];
			}
		}
		hist[i]['board'] = JSON.stringify(tempBoard);
		tempQueue = JSON.parse(hist[i]['queue']);
		for (j = 0; j < tempQueue.length; j++) {
			tempQueue[j] = reversed[tempQueue[j]];
		}
		hist[i]['queue'] = JSON.stringify(tempQueue);

		hist[i]['hold'] = reversed[hist[i]['hold']];
		hist[i]['piece'] = reversed[hist[i]['piece']];
	}
	board = tempBoard;
	queue = tempQueue;
	holdP = reversed[holdP];
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	updateQueue();
	clearActive();
	updateGhost();
	setShape();
}

function garbage(column, amount = 1) {
	for (i = 0; i < amount; i++) {
		garbageRow = new Array(10).fill({ t: 1, c: 'X' });
		garbageRow[column] = { t: 0, c: '' };
		board.shift();
		board.push(garbageRow);
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	updateGhost();
}

function aboutPopup() {
	window.alert(`START BY ADJUSTING KEYBINDS AND SETTINGS
zztetris
a tetris client with a name that starts with zz so you can type zz and have it autocomplete
forked from aznguy's schoolteto, a number of features added
inspired by fio's four-tris
---
Import/Export works through your clipboard. Doesn't work on Firefox.
Undo/redo is a thing. It keeps track of your board state history.
*Full* fumen import/export sets your board state history as the fumen pages and vice versa.
Drawing on the board is a thing.`);
}

function updateHistory() {
	histPos++;
	hist[histPos] = {
		board: JSON.stringify(board),
		queue: JSON.stringify(queue),
		hold: holdP,
		piece: piece,
	};
	if (histPos > 500) {
		// just in case hist is taking up too much memory
		hist.splice(0, 100);
		histPos -= 100;
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
				if (board[r + yPOS][c + xPOS].t == 1) {
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

	if (keysDown & flags.L) {
		lastKeys = keysDown;
		shiftDelay = DAS;
		shiftReleased = false;
		shiftDir = -1;
	} else if (keysDown & flags.R) {
		lastKeys = keysDown;
		shiftDelay = DAS;
		shiftReleased = false;
		shiftDir = 1;
	}
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

function undo() {
	if (histPos > 0) {
		histPos--;
		board = JSON.parse(hist[histPos]['board']);
		queue = JSON.parse(hist[histPos]['queue']);
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
}

function redo() {
	if (histPos < hist.length - 1) {
		board = JSON.parse(hist[histPos + 1]['board']);
		queue = JSON.parse(hist[histPos + 1]['queue']);
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

function restart() {
	xblast.sources = {
		columns: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
		types: {
			single: 4,
			double: 4,
			triple: 4,
			quad: 4,
			ts: 4,
			tsm: 4,
			tss: 4,
			tssm: 4,
			tsd: 4,
			tsdm: 4,
			tst: 4,
		},
	};

	if (board[board.length - 1].filter((c) => c.t == 0).length == boardSize[0]) {
		// lazy check, will have false positives, but whatever
		if (queue[6] == '|' && holdP == '') {
			// if they reset after resetting, just restart hist
			hist = [
				{
					board: JSON.stringify(board),
					queue: JSON.stringify(queue),
					hold: holdP,
					piece: piece,
				},
			];
			histPos = 0;
		}
	}
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

	combo = -1;
	b2b = -1;
	newPiece();
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

function updateKickTable() {
	kicks = kicksets[document.getElementById('kickset').value];
}

function callback() {
	// pieces = SRSX.pieces;
	// kicks = SRSX.kicks;
	kicks = kicksets['SRS+'];

	keysDown = 0;
	lastKeys = 0;
	shiftDir = 0;
	shiftReleased = true;

	document.getElementById('tc-re').addEventListener('touchstart', function (e) {
		input = 'RE';
		keysDown |= flags[input];
		restart();
	});

	document.getElementById('tc-hd').addEventListener('touchstart', function (e) {
		input = 'HD';
		keysDown |= flags[input];
		hardDrop();
	});

	document.getElementById('tc-h').addEventListener('touchstart', function (e) {
		input = 'HL';
		keysDown |= flags[input];
		hold();
	});

	document.getElementById('tc-dr').addEventListener('touchstart', function (e) {
		input = 'R180';
		keysDown |= flags[input];
		rotate('R180');
	});

	document.getElementById('tc-cc').addEventListener('touchstart', function (e) {
		input = 'CCW';
		keysDown |= flags[input];
		rotate('CCW');
	});

	document.getElementById('tc-c').addEventListener('touchstart', function (e) {
		input = 'CW';
		keysDown |= flags[input];
		rotate('CW');
	});

	document.getElementById('tc-d').addEventListener('touchstart', function (e) {
		input = 'SD';
		keysDown |= flags[input];
		sdID++;
		softDrop(sdID);
	});

	document.getElementById('tc-d').addEventListener('touchend', function (e) {
		input = 'SD';
		if (keysDown & flags[input]) keysDown ^= flags[input];
		sdID++;
	});

	document.getElementById('tc-r').addEventListener('touchstart', function (e) {
		input = 'R';
		keysDown |= flags[input];
	});

	document.getElementById('tc-r').addEventListener('touchend', function (e) {
		input = 'R';
		if (keysDown & flags[input]) keysDown ^= flags[input];
		if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
			dasID++;
			charged = false;
		}
	});

	document.getElementById('tc-l').addEventListener('touchstart', function (e) {
		input = 'L';
		keysDown |= flags[input];
	});

	document.getElementById('tc-l').addEventListener('touchend', function (e) {
		input = 'L';
		if (keysDown & flags[input]) keysDown ^= flags[input];
		if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
			dasID++;
			charged = false;
		}
	});

	document.addEventListener('keydown', function (e) {
		const input = ctrl[e.code];
		if (input) keysDown |= flags[input];
		if (e.repeat) return;
		if (input) {
			switch (input) {
				case 'SD':
					sdID++;
					softDrop(sdID);
					break;
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
				case 'RE':
					restart();
					break;
				case 'UNDO':
					undo();
					break;
				case 'REDO':
					redo();
					break;
			}
		}
	});

	document.addEventListener('keyup', function (e) {
		const input = ctrl[e.code];
		if (input) {
			if (keysDown & flags[input]) keysDown ^= flags[input];
			if (input == 'SD') sdID++;
			if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
				dasID++;
				charged = false;
			}
		}
	});

	newPiece();
	hist = [
		{
			board: JSON.stringify(board),
			queue: JSON.stringify(queue),
			hold: holdP,
			piece: piece,
		},
	];
	histPos = 0;
	combo = -1;
	b2b = -1;

	fullQuery = window.location.search;
	if (fullQuery.length > 0 && fullQuery[0] == '?') {
		queries = fullQuery.slice(1).split('&');
		for (let query of queries) {
			if (query.length > 0) {
				if (query.slice(0, 6) == 'fumen=') {
					// waow lazy handling
					fumen = query.slice(6);
					try {
						result = fullDecode(fumen, hist[0]);
						hist = JSON.parse(JSON.stringify(result));
						histPos = 0;
						board = JSON.parse(hist[0]['board']);
						queue = JSON.parse(hist[0]['queue']);
						holdP = hist[0]['hold'];
						piece = hist[0]['piece'];
						xPOS = spawn[0];
						yPOS = spawn[1];
						rot = 0;
						clearActive();
						updateGhost();
						setShape();
						updateQueue();
					} catch (error) {
						console.log(error);
					}
				}
				if (query.slice(0, 4) == 'pos=') {
					pos = parseInt(query.slice(4));
					if (!isNaN(pos) && hist.length > pos) {
						histPos = pos;
						board = JSON.parse(hist[pos]['board']);
						queue = JSON.parse(hist[pos]['queue']);
						holdP = hist[pos]['hold'];
						piece = hist[pos]['piece'];
						POS = spawn[0];
						yPOS = spawn[1];
						rot = 0;
						clearActive();
						updateGhost();
						setShape();
					}
				}
			}
		}
	}

	setInterval(() => {
		if (document.getElementById('grav').checked) move('SD');
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
		if (charged) {
			for (let i = 0; i < (ARR == 0 ? boardSize[0] : 1); i++) {
				var looooop = setInterval(function () {
					if (dasID == id) {
						move(dir);
					} else {
						clearInterval(looooop);
					}
				}, ARR);
			}
		} else {
			charging = true;
			setTimeout(() => {
				charging = false;
				charged = true;
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

	function checkShift() {
		// moving left/right with DAS and whatever
		// just pressed
		if (keysDown & flags.L && !(lastKeys & flags.L)) {
			shiftDelay = 0;
			arrDelay = 0;
			shiftReleased = true;
			shiftDir = -1;
			charged = false;
			dasID++;
			das('L', dasID);
		}
		if (keysDown & flags.R && !(lastKeys & flags.R)) {
			shiftDelay = 0;
			arrDelay = 0;
			shiftReleased = true;
			shiftDir = 1;
			charged = false;
			dasID++;
			das('R', dasID);
		}

		// just released
		else if (!(keysDown & flags.R) && lastKeys & flags.R && keysDown & flags.L) {
			shiftDir = -1;

			dasID++;
			das('L', dasID);
		} else if (!(keysDown & flags.L) && lastKeys & flags.L && keysDown & flags.R) {
			shiftDir = 1;

			dasID++;
			das('R', dasID);
		} else if ((!(keysDown & flags.L) && lastKeys & flags.L) || (!(keysDown & flags.R) && lastKeys & flags.R)) {
			shiftDelay = 0;
			arrDelay = 0;
			shiftReleased = true;
			shiftDir = 0;

			dasID++;
			//charged = false;
		} else if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
			//dasID++;
			//charged = false;
		}

		/*
        
		// Handle events
		if (shiftDir) {
			// 1. When key pressed instantly move over once.
			if (shiftReleased) {
				//shift(shiftDir);
				if (shiftDir == -1) move('L');
				if (shiftDir == 1) move('R');
				shiftDelay++;
				shiftReleased = false;
				// 2. Apply DAS delay
			} else if (shiftDelay < DAS) {
				shiftDelay++;
				// 3. Once the delay is complete, move over once.
				//     Increment delay so this doesn't run again.
			} else if (shiftDelay === DAS && DAS !== 0) {
				//shift(shiftDir);
				if (shiftDir == -1) move('L');
				if (shiftDir == 1) move('R');
				if (ARR !== 0) shiftDelay++;
				// 4. Apply ARR delay
			} else if (arrDelay < ARR) {
				arrDelay++;
				// 5. If ARR Delay is full, move piece, and reset delay and repeat.
			} else if (arrDelay === ARR && ARR !== 0) {
				//shift(shiftDir);
				if (shiftDir == -1) move('L');
				if (shiftDir == 1) move('R');
			} else if (ARR === 0) {
				for (let i = 0; i < 9; i++) {
					if (shiftDir == -1) move('L');
					if (shiftDir == 1) move('R');
				}
			}
        }
        */

		if (lastKeys !== keysDown) {
			lastKeys = keysDown;
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
			if (queue[0] == '|') queue.shift();
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
					if (corner[0] >= 40 || corner[1] < 0 || corner[1] >= 10) filledFacingCorners++;
					else if (board[corner[0]][corner[1]]['t'] == 1) filledFacingCorners++;
				});
				mini = filledFacingCorners < 2; // no I'm not adding the "TST Kick and Fin Kick" exceptions. STSDs and Fins deserve to be mini
			}
		}

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

		if (board[board.length - 1].filter((c) => c.t == 0).length == boardSize[0]) pc = true;

		if (cleared == 0) combo = -1;
		else {
			combo += 1;
		}

		if (cleared > 0) {
			if (tspin || cleared == 4) b2b += 1;
			else b2b = -1;
		}

		text = '';
		if (combo > 0) text += combo.toString() + '_COMBO\n';
		if (b2b > 0 && (tspin || cleared == 4)) text += 'B2B ';
		if (mini) text += 'MINI ';
		if (tspin) text += 'T-SPIN ';
		if (cleared > 4) cleared = 4; // nani
		if (cleared > 0) text += ['NULL', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][cleared];
		if (pc) text += '\nPERFECT\nCLEAR!';

		if (text != '') notify(text);
		if (tspin || cleared == 4) playSnd('ClearTetra', true);
		if (pc) playSnd('PerfectClear', 1);

		originality_delta = 0;

		if (cleared == 0) {
			if (tspin) {
				if (mini) {
					e = xblast.sources.types['tsm'];
					originality_delta += e < 0.5 ? -2 : e;
					xblast.sources.types['tsm'] = 0;
				} else {
					e = xblast.sources.types['ts'];
					originality_delta += e < 0.5 ? -2 : e;
					xblast.sources.types['ts'] = 0;
				}
			}
		} else if (cleared == 1) {
			if (tspin) {
				if (mini) {
					e = xblast.sources.types['tssm'];
					originality_delta += e < 0.5 ? -2 : e;
					xblast.sources.types['tssm'] = 0;
				} else {
					e = xblast.sources.types['tss'];
					originality_delta += e < 0.5 ? -2 : e;
					xblast.sources.types['tss'] = 0;
				}
			} else {
                e = xblast.sources.types['single'];
                originality_delta += e < 0.5 ? -2 : e;
                xblast.sources.types['single'] = 0;
			}
		} else if (cleared == 2) {
			if (tspin) {
				if (mini) {
					e = xblast.sources.types['tsdm'];
					originality_delta += e < 0.5 ? -2 : e;
					xblast.sources.types['tsdm'] = 0;
				} else {
					e = xblast.sources.types['tsd'];
					originality_delta += e < 0.5 ? -2 : e;
					xblast.sources.types['tsd'] = 0;
				}
			} else {
				e = xblast.sources.types['double'];
				originality_delta += e < 0.5 ? -2 : e;
				xblast.sources.types['double'] = 0;
			}
		} else if (cleared == 3) {
			if (tspin) {
				e = xblast.sources.types['tst'];
				originality_delta += e < 0.5 ? -2 : e;
				xblast.sources.types['tst'] = 0;
			} else {
				e = xblast.sources.types['triple'];
				originality_delta += e < 0.5 ? -2 : e;
				xblast.sources.types['triple'] = 0;
			}
		} else if (cleared == 4) {
			e = xblast.sources.types['quad'];
			originality_delta += e < 0.5 ? -2 : e;
			xblast.sources.types['quad'] = 0;
		}

		if (cleared > 0 || tspin) {
			var p = pieces[piece][rot];
			temp = [];
			p.map((r, i) => {
				r.map((c, ii) => {
					if (c == 1) {
						temp.push(ii + xPOS);
						//xblast.sources.columns[ii + xPOS] = 0;
					}
				});
			});
			temp = [...new Set(temp)]; // remove dupes by converting to Set and back again lul
			for (columnIndex of temp) {
				const s = Math.min(1, xblast.sources.columns[columnIndex]);
				originality_delta += s < 0.5 ? -1 : s;
				xblast.sources.columns[columnIndex] = 0;
            }
            
            console.log(originality_delta);

			if (originality_delta >= 4 + cleared) notify('COOL');
			else if (originality_delta < 0) notify('REGRET');
		}
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
		checkShift();

		let e = 0;
		for (const s of xblast.sources.columns) e += 4 - s;
		for (const s of Object.values(xblast.sources.types)) e += 4 - s;
		const s = Math.pow(1.05, Math.max(0, e - 8)) / 600;
		for (let e = 0; e < xblast.sources.columns.length; e++)
			xblast.sources.columns[e] = Math.min(4, xblast.sources.columns[e] + s);
		for (const e of Object.keys(xblast.sources.types))
			xblast.sources.types[e] = Math.min(4, xblast.sources.types[e] + s);

		for (colIndex = 0; colIndex < 10; colIndex++) {
			val = xblast.sources.columns[colIndex];
			height = (val / 4) * 100;
			meter = document.getElementById('column ' + colIndex.toString()).getContext('2d');
			meter.clearRect(0, 0, 30, 100);
			meter.strokeStyle = 'white';
			meter.beginPath();
			meter.rect(0, 0, 30, 100);
			meter.stroke();
			meter.fillStyle = val < 0.5 ? 'red' : 'green';
			meter.fillRect(0, 100 - height, 30, height);
		}

		for (type of ['single', 'double', 'triple', 'quad', 'ts', 'tsm', 'tss', 'tssm', 'tsd', 'tsdm', 'tst']) {
			val = xblast.sources.types[type];
			height = (val / 4) * 100;
			meter = document.getElementById(type).getContext('2d');
			meter.clearRect(0, 0, 30, 100);
			meter.strokeStyle = 'white';
			meter.beginPath();
			meter.rect(0, 0, 30, 100);
			meter.stroke();
			meter.fillStyle = val < 0.5 ? 'red' : 'green';
			meter.fillRect(0, 100 - height, 30, height);
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
		//window.requestAnimationFrame(render);
	}
	
	setInterval(() => {
		render();
	}, 1000/30);
    
	//window.requestAnimationFrame(render);
}
