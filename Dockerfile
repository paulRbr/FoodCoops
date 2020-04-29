FROM python:2
ARG ODOO_VERSION=9.0

WORKDIR /app/odoo

RUN git clone -b "$ODOO_VERSION" --single-branch --depth 1 https://github.com/odoo/odoo.git /app/odoo
RUN ls && \
        apt update && \
        apt install -y libsasl2-dev python-dev libldap2-dev libssl-dev libpq-dev python-psycopg2 python-passlib nodejs npm && \
        pip install -r requirements.txt && \
        npm install -g less
# Bug with GLIBC (see https://github.com/psycopg/psycopg2-wheels/issues/2)
RUN pip install psycopg2 --upgrade
# FoodCoops specificities (needed by the 'report_xlsx' module)
RUN pip install XlsxWriter

ADD . /app/

ADD ./odoo.conf /etc/odoo.conf

CMD ./odoo.py --addons-path=addons,../extra_addons,../intercoop_addons,../louve_addons \
        --update=connector,account,point_of_sale,sale,purchase,stock,website,hr,coop_account,coop_shift \
        --init=connector,account,point_of_sale,sale,purchase,stock,website,hr,coop_account,coop_shift \
        --without-demo=all \
        --config=/etc/odoo.conf
