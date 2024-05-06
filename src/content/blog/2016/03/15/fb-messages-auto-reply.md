---
title: Facebook Messages Auto-reply
category: blog
tags: [programming, facebook, python]
date: 2016-03-15
description: "Use selenium to check for unread Facebook messages and send a reply"
---

I don't like using Facebook messages. I don't see what it offers beyond email, and we _already have email_. Email has doesn't restrict you to a single provider. It's been around a long time, so there's a lot of software that already knows how to talk to it.

But sometimes people send me messages, and I didn't want to just miss those messages. I wanted some kind of vacation-responder (you know, like email has) to let folks know I wasn't just ignoring them.

So I wrote one! The code is below, but it just logs into facebook for me, checks for unread messages, and sends a reply to each one. I found some advice for [accessing the password keychain programmatically](http://blog.macromates.com/2006/keychain-access-from-shell/) and [scheduling jobs to run every so often](http://killtheyak.com/schedule-jobs-launchd/).

```python
#!/usr/bin/env python
import time
import subprocess
from selenium import webdriver
from bs4 import BeautifulSoup


def get_password():
    """
    Source: http://blog.macromates.com/2006/keychain-access-from-shell/
    """
    output = subprocess.check_output(
        'security find-generic-password -l fb_spoof -g 2>&1 > /dev/null',
        shell=True)
    return output.split(' ')[-1].strip('" \n')


def send_reply(driver, message_url):
    driver.get(message_url)
    textarea = driver.find_element_by_name('message_body')
    textarea.send_keys('''The following is an automated reply:
Hi, thanks for your message :)
I'm trying to avoid using Facebook Messages, so I won't check it very often.
If you'd like to talk to me, please send an email to bgschiller@gmail.com
Thanks!
-Brian''')
    soup = BeautifulSoup(driver.page_source, 'html.parser')
    reply = soup.select('input[value="Reply"]')[0]
    driver.find_element_by_id(reply.attrs['id']).click()


def log_in(driver):
    driver.get('https://facebook.com')

    driver.find_element_by_id('email').send_keys('bgschiller')
    driver.find_element_by_id('pass').send_keys(get_password())
    driver.find_element_by_id('loginbutton').click()


def any_messages(driver):
    return driver.find_element_by_id('mercurymessagesCountValue').get_attribute('innerHTML') != '0'


def unread_messages(driver):
    driver.find_element_by_name('mercurymessages').click()
    time.sleep(2)
    soup = BeautifulSoup(driver.page_source, 'html.parser')
    messages = soup.find_all(class_='messagesContent')
    unread_messages = [m for m in messages
                       if m.find(attrs={'data-tooltip-content': "Mark as Read"})]
    print 'found {} messages ({} unread)'.format(len(messages), len(unread_messages))
    for unread_message in unread_messages:
        print '  unread message from', unread_message.find(class_='author').text
    return unread_messages


def main():
    driver = webdriver.PhantomJS()
    driver.set_window_size(1024, 768)
    driver.implicitly_wait(1)

    log_in(driver)

    driver.save_screenshot('screen.png')

    for unread_message in unread_messages(driver):
        send_reply(driver, unread_message.attrs['href'])
        time.sleep(2)

if __name__ == '__main__':
    main()
```

I'm not totally sold on how I'm storing the password here. If you have a suggestion for a better way &mdash; or other advice &mdash; please send me an _email_.
