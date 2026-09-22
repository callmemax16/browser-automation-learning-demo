// 找到 Popup 的课号输入框等
const courseCodeInput = document.querySelector("#courseCode");
const sectionInput=document.querySelector("#section");
const startTimeInput = document.querySelector("#startTime");
const startButton=document.querySelector("#startButton");
const delaySecondsInput = document.querySelector("#delaySeconds");
const targetSelectorInput = document.querySelector("#targetSelector");
const statusText = document.querySelector("#statusText");


//读取配置
chrome.storage.local.get(["courseCode","section","startTime","delaySeconds","targetSelector"],(result)=>{
    // 将保存的课号等信息显示到输入框。如果之前没有保存过，显示空字符串
    courseCodeInput.value=result.courseCode||"";
    sectionInput.value=result.section||"";
    startTimeInput.value=result.startTime||"";
    // 回显延迟秒数；从未保存过时显示 0
    delaySecondsInput.value=result.delaySeconds ?? 0;
    targetSelectorInput.value=result.targetSelector||"button";
});


//用户点击开始按钮时执行-读取用户输入的值
startButton.addEventListener("click",()=>{
    // 读取课号、分班输入框内容
    const courseCode=courseCodeInput.value.trim();
    const section=sectionInput.value.trim();
    //读取此刻选择的开始时间
    const startTime = startTimeInput.value;
    // 读取延迟秒数并转换为数字
    const delaySeconds = Number(delaySecondsInput.value);
    // 读取目标选择器；如果用户没填写，就默认从全部 button 元素中寻找
    const targetSelector = targetSelectorInput.value.trim() || "button";
    // 如果用户刚才留空，把默认的 button 显示回输入框
    targetSelectorInput.value = targetSelector;
    // 尝试使用用户填写的目标选择器，检查格式是否正确
    try {
        document.querySelector(targetSelector);
    } catch (error) {
        statusText.textContent = "目标选择器格式错误，请检查后重试";
        return;
    }

    // 如果课号为空：在 Popup 显示提示
    if (!courseCode) {
        statusText.textContent = "请填写课号";
        // 停止本次点击函数，不保存配置，也不发送消息
        return;
    }

    if (!section) {
        statusText.textContent = "请填写分班";
        return;
    }

    if (!startTime) {
        statusText.textContent = "请选择开始时间";
        return;
    }
    //开始时间已过提示
    const targetTime = new Date(startTime).getTime();
    if (targetTime <= Date.now()) {
        statusText.textContent = "开始时间已过，请重新选择";
        return;
    }

    console.log("已成功读取",courseCode, section, startTime,delaySeconds,targetSelector);


    //保存配置
    chrome.storage.local.set({courseCode,section,startTime,delaySeconds,targetSelector},()=>{
        console.log("已保存：",{courseCode,section,startTime,delaySeconds,targetSelector});
        // 把时间中的 T 替换成空格，显示时更易懂
        const readableStartTime = startTime.replace("T", " ");
        // 把“配置已保存、等待执行”的信息显示给用户
        statusText.textContent = `已保存，将在 ${readableStartTime} 开始执行`;

        //保存后找当前网页，向网页中的content.js发送消息-传值
        chrome.tabs.query({active: true, currentWindow: true},(tabs)=>{
            const currentTab=tabs[0];

            chrome.tabs.sendMessage(currentTab.id,{
                action:"start",
                courseCode:courseCode,
                section:section,
                startTime:startTime,
                delaySeconds:delaySeconds,
                targetSelector:targetSelector,
            },(response)=>{
                //收到回复后在console显示
                console.log("console.js回复:",response);
            });
        });
    });
});