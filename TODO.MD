## TODO
when writting code, make sure not break unrelated parts, when remove some code, also remove or modify related code in other place, when finished the task, remove the task in TODO, you can add some suggestion at TODO 

2. when fetch note content, you can received like this:
```

{note_id: "test_space_woi_1735308100980", title: "test_space",…}
content
: 
"\n<div class=\"block\">Use html to give the text  cool font style, different color for each word in the text make them looks clear, cute and attractive too , just give me html without wrap in ```, keep text in one line:\nLLM stands for <b>Large Language Model\n</b><p><span style=\"font-family: &quot;Comic Sans MS&quot;; color: red;\">LLM</span> <span style=\"font-family: &quot;Comic Sans MS&quot;; color: orange;\">stands</span> <span style=\"font-family: &quot;Comic Sans MS&quot;; color: yellow;\">for</span> <span style=\"font-family: &quot;Comic Sans MS&quot;; color: green;\">Large</span> <span style=\"font-family: &quot;Comic Sans MS&quot;; color: blue;\">Language</span> <span style=\"font-family: &quot;Comic Sans MS&quot;; color: purple;\">Model</span></p><span style=\"background-color: rgb(248, 249, 250);\"></span><b>\n</b></div>\n<div class=\"block\"><h2>AI Response (gpt-4o-mini)</h2></div><div class=\"block\"><h2><br></h2>\n</div>\n\n\n\n\n\n\n\n\n\n\n\n<div class=\"block\"><h2>AI Response (gpt-4o-mini)</h2>\n\n\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Cool Text Style</title>\n    <style>\n        .text {\n            font-family: 'Arial', sans-serif;\n            font-size: 24px;\n            font-weight: bold;\n        }\n        .word1 { color: #FF5733; }  /* Red */\n        .word2 { color: #33FF57; }  /* Green */\n        .word3 { color: #3357FF; }  /* Blue */\n        .word4 { color: #FF33A1; }  /* Pink */\n        .word5 { color: #FFD733; }  /* Yellow */\n    </style>\n\n\n    <div class=\"text\">\n        <span class=\"word1\">LLM</span> \n        <span class=\"word2\">stands</span> \n        <span class=\"word3\">for</span> \n        <span class=\"word4\">Large</span> \n        <span class=\"word5\">Language</span> \n        <span class=\"word1\">Model</span>\n    </div>\n\n</div>\n<div class=\"block\"><h2>Answer for ask by (gpt-4o-mini)</h2><h1>What is LLM?</h1>\n<p style=\"font-family: Arial, sans-serif; font-size: 20px;\">\n  <span style=\"color: #FF5733;\">LLM</span>\n  <span style=\"color: #33FF57;\">stands</span>\n  <span style=\"color: #3357FF;\">for</span>\n  <span style=\"color: #F1C40F;\">Large</span>\n  <span style=\"color: #8E44AD;\">Language</span>\n  <span style=\"color: #E74C3C;\">Model</span>.\n</p></div>\n<div class=\"block\"><h2>AI Response (gpt-4o)</h2>\n  \n    <style>\n      .word {\n        font-family: \"Comic Sans MS\", \"Arial\", sans-serif;\n        font-weight: bold;\n        font-size: 24px;\n        margin-right: 5px;\n        display: inline-block;\n      }\n    </style>\n  \n  \n    <span class=\"word\" style=\"color: #FF5733;\">LLM</span>\n    <span class=\"word\" style=\"color: #33FF57;\">stands</span>\n    <span class=\"word\" style=\"color: #3357FF;\">for</span>\n    <span class=\"word\" style=\"color: #FF33A1;\">Large</span>\n    <span class=\"word\" style=\"color: #A133FF;\">Language</span>\n    <span class=\"word\" style=\"color: #FFC300;\">Model</span>\n  \n</div>\n<div class=\"block\"><h2><br></h2>  \n</div>\n<div class=\"block\"><h2><br></h2></div><div class=\"block\">\n \n</div>\n\n"
folder_id
: 
"1733631707928main0.7511123375624986"
last_updated
: 
"2024-12-27 14:22:44"
note_id
: 
"test_space_woi_1735308100980"
title
: 
"test_space"

```
as you can see there is last_updated , i want you use this for sync function, when use click the page or type , try to compare local last_updated and remote last_updated, if remote is more new, replace current note, but in next 10 seconds, dont trigger sync to make it not disruptive

1. (finished by claude sonet 3.5) Replace the original title display above the note content  with a tab system. The tabs should dynamically show the titles of recent notes, and clicking on a tab should display the content of the corresponding note in the editor, and make the title to leftest and bold, also it should be editable like before so user can rename the tilte. The tabs should be placed in a single horizontal line where the original title was, and the most recent note should be displayed by default when the interface is loaded . you can store recent notes info in localstorage