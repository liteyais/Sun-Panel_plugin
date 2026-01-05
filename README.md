# Sun-panel：js脚本使用方法
## 1、一种是直接复制代码，粘贴保存
粘贴到【全局设置】→【自定义JS和CSS文件】的输入框中，直接使用。优点就是粘贴后保存刷新就行。缺点是只能粘贴一个效果的代码，多个会有冲突或者bug。<br/><br/>
<img width="594" height="229" alt="01" src="https://github.com/user-attachments/assets/9e9598f6-46c3-4457-af1a-32ff3d92c989" /><br/><br/><br/>



## 2、另外一种，用壳加载多个js或css
在【全局设置】→【自定义JS和CSS文件】粘贴壳（多JS、CSS调用的脚本js，暂且简称壳）。只需要在壳js代码中，把效果的js路径设或文件名设置下。然后把你的效果的js或者css放到你的nas文件夹custom中即可。<br/><br/>
步骤：<br/>
①、在【全局设置】→【自定义JS和CSS文件】粘贴壳js。代码在这。可用编辑器打开后复制代码。<br/><br/>
<img width="594" height="229" alt="02" src="https://github.com/user-attachments/assets/8a61e809-6756-4355-9bac-03c36c4c6c13" /><br/><br/>

②、把你的js效果或css放到nas的对应文件夹内：【custom】<br/><br/>
<img width="417" height="331" alt="03" src="https://github.com/user-attachments/assets/ebfaffef-6a1a-4859-9829-4140507a1387" /><br/><br/>

③、在壳js中设置，更改效果js后者css的路径或文件名，如果你放到了custom文件夹下，那就只改下文件名就行。<br/><br/>
<img width="624" height="203" alt="04" src="https://github.com/user-attachments/assets/65356461-2dcc-4170-ab2a-cc5dd68420be" /><br/><br/>
