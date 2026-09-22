//超时停止/运行状态停止功能
// 保存“等待网页元素”的超时定时器编号
let waitTimeoutTimerId = null;

//清除旧任务功能
//创建两个定时器的id
let startTimeTimerId = null;
let delayTimerId = null;
//创建监听器的id
let activeObserver = null;

function clearOldTask() {
    // 如果存在“等待开始时间”的定时器：取消
    if (startTimeTimerId !== null) {
        clearTimeout(startTimeTimerId);
        startTimeTimerId = null;
    }
    if (delayTimerId !== null) {
        clearTimeout(delayTimerId);
        delayTimerId = null;
    }

    // 如果存在“等待网页元素”的超时定时器：取消
    if (waitTimeoutTimerId !== null) {
        clearTimeout(waitTimeoutTimerId);
        waitTimeoutTimerId = null;
    }
    //如果存在监听器：取消
    if (activeObserver !== null) {
        activeObserver.disconnect();
        activeObserver = null;
    }
    console.log("已清除上一次预约任务");
}


//消息通信 收到开始消息后开始执行
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
    if(msg.action==='start'){
        // 收到新的预约时，先清除上一次的旧任务
        clearOldTask();

        // 接收 Popup 传来的值
        console.log("收到popup消息:",msg);
        const CourseCode = msg.courseCode;
        const section = msg.section;
        const startTime = msg.startTime;
        const delaySeconds = Number(msg.delaySeconds);
        const targetSelector = msg.targetSelector;
        console.log("收到的开始时间：", startTime);
        console.log("收到的延迟秒数：", delaySeconds);

        // 把开始时间转换成毫秒时间戳，方便和当前时间比较
        const targetTime = new Date(startTime).getTime();
        // 用“目标时间减当前时间”，算出还需要等待多少毫秒
        const delay = targetTime - Date.now();
        console.log("距离开始还剩：", delay, "毫秒");


        //自动输入function（只负责已知输入框后填写课号）
        function setInput(input, value) {

            const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value'
            ).set;

            setter.call(input, value);

            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }


        //自动申请function
        function tryApply(){
            //点“输入课号申请”页签
            const courseNumberTab=[...document.querySelectorAll("button")].find(
                button=>button.textContent.replace(/\s/g,"")==="학수번호입력하여신청"
            );
            if(!courseNumberTab)return false;

            courseNumberTab.click();

            //找到课号和分班输入框
            const inputs=document.querySelectorAll("input[type=text]");
            if(inputs.length<2)return false;

            //自动填写课号和分班
            setInput(inputs[0],CourseCode);
            setInput(inputs[1],section);

            //点击“申请”按钮
            const applyButton=[...document.querySelectorAll(targetSelector)].find(
                element=>element.textContent.trim()==="신청"&&!element.disabled
            );
            //如果没找到申请按钮，结束本次尝试
            if(!applyButton)return false;

            //动态元素标记
            //将已点击的申请按钮标记为clicked
            if(applyButton.dataset.clicked) return false;
            applyButton.dataset.clicked = true;

            applyButton.click();

            console.log("已自动填写课号和分班并点击申请")

            //告诉外部本次申请成功
            return true;
        }


        // 执行自动申请并动态监听的function
        function startAutoApply() {
            //监听DOM
            //先立刻尝试一次自动申请
            if(!tryApply()){
                //没有成功，开始监听DOM
                console.log("未找到目标元素，开始等待网页加载");
                //创建DOM变化监听器，页面新增或删除元素时执行
                //activeObserver是全局变量 因此可在外面停止监听器
                activeObserver=new MutationObserver(()=>{
                    //DOM变化时，自动执行大括号中的代码

                    //先重新尝试申请
                    //applied 保存 tryApply() 的结果：true 或 false
                    const applied=tryApply();

                    //如果本次申请成功，停止监听
                    if(applied){
                        //不再需要等待超时
                        clearTimeout(waitTimeoutTimerId);
                        waitTimeoutTimerId = null;
                        activeObserver.disconnect();
                    }
                });

                //用监听器开始监听网页body
                activeObserver.observe(document.body,{
                    //监听元素新增或删除
                    childList:true,
                    //监听body内部所有层级
                    subtree:true
                });

                // 开始30 秒的超时倒计时：如果30秒后监听器还在运行，停止监听页面变化
                waitTimeoutTimerId = setTimeout(() => {
                    if (activeObserver !== null) {
                        activeObserver.disconnect();
                        activeObserver = null;
                        console.log("超时未找到目标元素，任务已停止");
                    }
                    waitTimeoutTimerId = null;
                }, 30000);
            }
        }


        //最后包含延迟秒数后执行的function
        function startAfterDelay() {
            // 等待延迟秒数后：
            if (delaySeconds > 0) {
                console.log(`开始时间已到，${delaySeconds} 秒后执行`);

                //创建“延迟执行”的定时器，并记住它的编号
                delayTimerId=setTimeout(() => {
                    console.log("延迟等待结束，开始执行");
                    // 调用原来的自动申请流程
                    startAutoApply();
                }, delaySeconds * 1000);

                // 没设置延迟时，直接调用原来的自动申请流程
            } else {
                console.log("开始时间已到，立即执行");
                startAutoApply();
            }
        }


        //时间判断并调用startAfterDelay
        // 如果开始时间还没到:
        if (delay > 0) {
            console.log("等待到开始时间后执行");
            // 创建“等待到开始时间后执行”的定时器，并记住它的编号
            startTimeTimerId = setTimeout(startAfterDelay, delay);
            // 如果时间已到，或已经过期:
        } else {
            console.log("开始时间已到，立即执行");
            // 立刻开始自动填写和点击
            startAfterDelay();
        }
        //回复popup
        sendResponse({ok:true,message:"已收到开始指令"});
    }
});


