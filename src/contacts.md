---
layout: page.njk
title: Контакты
subtitle: "Свяжитесь с нами удобным для вас способом"
description: "Свяжитесь с «Лигой защитников потребителей» в Белгороде: телефоны, электронная почта, адрес офиса и график работы."
active: contacts
grid: grid--2
cards:
  - icon: fa-phone-alt
    title: Звоните
    body: |-
      **Телефон:** [{{ site.phone1Display }}](tel:{{ site.phone1 }})

      **Телефон:** [{{ site.phone2Display }}](tel:{{ site.phone2 }})

      Звонки принимаются в будние дни с 9:00 до 17:30

  - icon: fa-envelope
    title: Пишите
    body: |-
      **Электронная почта:** [{{ site.email }}](mailto:{{ site.email }})

      Отправляйте письма с вопросами, документами. Ответим быстро.

  - icon: fa-map-marker-alt
    title: Приходите
    body: |-
      **Адрес офиса:**

      [{{ site.address.locality }}, {{ site.address.street }}]({{ site.address.map }}) (вход со стороны улицы, левый угол дома, 1 этаж)

  - icon: fa-calendar-alt
    title: Планируйте
    body: |-
      **График работы:**

      Понедельник – пятница: с 09:00 до 17:30

      Суббота, воскресенье: нерабочие дни
---
