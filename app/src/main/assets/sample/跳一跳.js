// clone from https://github.com/wangshub/wechat_jump_game
// http://www.autojs.org/assets/uploads/files/1514787928375-wechatjumpingai.js
auto();
if (!requestScreenCapture()) {
 toast("请求截图失败");
 exit();
}
var window = floaty.window(
 <frame>
 <button id = "action" text = "开始运行" w = "90" h = "40" bg = "#77ffffff" />
 </frame>
);

var workDir = "sdcard/autojs/wechat_jump/";
var backupsDir = workDir + "screenshot_backups/";
var trainingDataDir = workDir + "training_data/";

var piece_body_width = 70;
var press_coefficient = 1.392;

var piece_dist_from_top_to_base = 188;
const piece_color = "#3d3752";    //棋子大致颜色

var swipe_x1, swipe_y1, swipe_x2, swipe_y2;

var running = false;

function pullScreenshot() {
 var ts = new Date();
 var image = images.captureScreen();
 image.saveTo(backupsDir + ts.getTime() + ".png");
 image.saveTo(workDir + "1.png");
 return image;
}

function findPieceAndBoard(image) {
 var w = image.getWidth();
 var h = image.getHeight();
 log("image width and height:", w, h);
 var board_x = 0
 var board_y = 0
 scan_x_border = w / 8
 scan_start_y = 0

 //使用内置找色函数找出棋子最顶部的位置
    var piece_top = findColor(image, piece_color, {
        threshold: 3
    });
    if(!piece_top){
        return "";
    }

    var piece_start_x = -1;
    var piece_end_x = -1;
    //遍历该行找出棋子顶部中点位置
    for(var x = 0; x < w; x++){
        var is_piece = images.detectsColor(image, piece_color, x, piece_top.y, 2);
        if(is_piece && piece_start_x < 0){
            piece_start_x = x;
        }
        if(!is_piece && piece_start_x >= 0){
            piece_end_x = x;
            break;
        }
    }
    //棋子顶部中点位置
    var piece_top_center_x = (piece_start_x + piece_end_x) / 2;

    var piece_x = piece_top_center_x;
    var piece_y = piece_top.y + piece_dist_from_top_to_base;

 log("piece position:", piece_x, piece_y);

 // #限制棋盘扫描的横坐标，避免音符bug
 var board_x_start = 0;
 var board_x_end = 0;
 if (piece_x < w / 2) {
  board_x_start = piece_x;
  board_x_end = w;
 } else {
  board_x_start = 0;
  board_x_end = piece_x
 }
 var last_pixel;
 var i = 0;
 for (i = parseInt(h / 3); i < parseInt(h * 2 / 3); i++) {
  last_pixel = image.pixel(0, i);
  if (board_x > 0 || board_y > 0) {
   break;
  }
  var board_x_sum = 0;
  var board_x_c = 0;
  for (var j = board_x_start; j < board_x_end; j++) {
   var pixel = image.pixel(j, i);
   //修掉脑袋比下一个小格子还高的情况的 bug
   if (Math.abs(j - piece_x) < piece_body_width) {
    continue;
   }
   //修掉圆顶的时候一条线导致的小 bug，这个颜色判断应该 OK，暂时不提出来
   if (Math.abs(colors.red(pixel) - colors.red(last_pixel)) +
    Math.abs(colors.green(pixel) - colors.green(last_pixel)) +
    Math.abs(colors.blue(pixel) - colors.blue(last_pixel)) > 10
   ) {
    board_x_sum += j;
    board_x_c += 1;
   }
  }
  if (board_x_sum > 0) {
   board_x = parseInt(board_x_sum / board_x_c);
  }
 }
 last_pixel = image.pixel(board_x, i);

 // # 从上顶点往下+274的位置开始向上找颜色与上顶点一样的点，为下顶点
 // # 该方法对所有纯色平面和部分非纯色平面有效，对高尔夫草坪面、木纹桌面、药瓶和非菱形的碟机（好像是）会判断错误
 var k = 0;
 for (k = i + 274; k > i; k--) {
  var pixel = image.pixel(board_x, k);
  if (Math.abs(colors.red(pixel) - colors.red(last_pixel)) +
   Math.abs(colors.green(pixel) - colors.green(last_pixel)) +
   Math.abs(colors.blue(pixel) - colors.blue(last_pixel) < 10)
  ) {
   break;
  }
 }
 board_y = parseInt((i + k) / 2);
 // # 如果上一跳命中中间，则下个目标中心会出现r245 g245 b245的点，利用这个属性弥补上一段代码可能存在的判断错误
 // # 若上一跳由于某种原因没有跳到正中间，而下一跳恰好有无法正确识别花纹，则有可能游戏失败，由于花纹面积通常比较大，失败概率较低
 for (var l = i; l < i + 200; l++) {
  pixel = image.pixel(board_x, l);
  if (Math.abs(colors.red(pixel) - 245) +
   Math.abs(colors.green(pixel) - 245) +
   Math.abs(colors.blue(pixel) - 245) == 0) {
   board_y = l + 10;
   break;
  }
 }

 if (board_y * board_x == 0) {
  return "";
 }
 log("board:", board_x, board_y);
 return {
  piece_x: piece_x,
  piece_y: piece_y,
  board_x: board_x,
  board_y: board_y
 };

}

function setButtonPosition(image) {
 var w = image.getWidth();
 var h = image.getHeight();
 swipe_x1 = w / 2;
 swipe_y1 = parseInt(1584 * (h / 1920.0));
 swipe_x2 = swipe_x1;
 swipe_y2 = swipe_y1;
}

function jump(distance) {
 log("distance:", distance);
 var press_time = distance * press_coefficient;
 press_time = Math.max(press_time, 200); // 设置 200 ms 是最小的按压时间
 press_time = parseInt(press_time);
 swipe(swipe_x1, swipe_y1, swipe_x2, swipe_y2, press_time);
 log("press_time:", press_time);
 return press_time;
}



function main() {
 toast("请先将游戏点开始运行。");
    sleep(2000);

 log("开始...");
 var dir = new java.io.File(backupsDir);
 dir.mkdirs();


 // var pngFiles = files.listDir(trainingDataDir, function(name) {
 //  return name.endsWith(".png") && files.isFile(files.join(trainingDataDir, name));
 // });
 // for (var i = 0; i < pngFiles.length; i++) {
 //  var file = pngFiles[i];
 //  log(file);
 //  var image = images.read(trainingDataDir + file);

 while (1) {
  if (running) {
   var image = pullScreenshot();

   var pbResult = findPieceAndBoard(image);
   log("pbResult:", pbResult);
   setButtonPosition(image);
   var x_sqrt = Math.pow(pbResult.board_x - pbResult.piece_x, 2);
   var y_sqrt = Math.pow(pbResult.board_y - pbResult.piece_y, 2);
   if (running) {
    jump(Math.sqrt(x_sqrt + y_sqrt));
    log("等待2s");
    sleep(2000);
   }
  } else {
   sleep(1000);
   log("已暂停");
  }
 }
}

setInterval(() => {}, 1000);
//记录按键被按下时的触摸坐标
var x = 0,
 y = 0;
//记录按键被按下时的悬浮窗位置
var windowX, windowY;
//记录按键被按下的时间以便判断长按等动作
var downTime;

window.action.setOnTouchListener(function(view, event) {
 switch (event.getAction()) {
  case event.ACTION_DOWN:
   x = event.getRawX();
   y = event.getRawY();
   windowX = window.getX();
   windowY = window.getY();
   downTime = new Date().getTime();
   return true;
  case event.ACTION_MOVE:
   //移动手指时调整悬浮窗位置
   window.setPosition(windowX + (event.getRawX() - x),
    windowY + (event.getRawY() - y));
   //如果按下的时间超过2秒判断为长按，退出脚本
   if (new Date().getTime() - downTime > 2000) {
    if (Math.abs(event.getRawY() - y) < 5 && Math.abs(event.getRawX() - x) < 5) {
    exit();
    }
   }
   return true;
  case event.ACTION_UP:
   //手指弹起时如果偏移很小则判断为点击
   if (Math.abs(event.getRawY() - y) < 5 && Math.abs(event.getRawX() - x) < 5) {
    onClick();
   }
   return true;
 }
 return true;
});

function onClick() {
 if (window.action.getText() == '开始运行') {
  running = true;
  window.action.setText('停止运行');
 } else {
  running = false;
  window.action.setText('开始运行');
 }
}
window.setPosition(800,1400);

main();