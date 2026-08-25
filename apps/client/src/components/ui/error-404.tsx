import { Title, Text, Button, Container, Group } from "@mantine/core";
import classes from "./error-404.module.css";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { getAppName } from "@/lib/config.ts";

export function Error404() {
  const { t } = useTranslation();

  // 이 화면은 라우트가 이미 커밋된 뒤에 늦게 마운트돼서 Helmet 이 head 를
  // 갱신하지 않는다(head 에 data-rh 흔적이 안 남는 걸로 확인). 탭 제목은
  // 직접 쓴다 — 다른 라우트로 나가면 그쪽 Helmet 이 다시 덮어쓴다.
  const title = `${t("404 page not found")} - ${getAppName()}`;
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <Container className={classes.root}>
        <Title className={classes.title}>{t("404 page not found")}</Title>
        <Text c="dimmed" size="lg" ta="center" className={classes.description}>
          {t("Sorry, we can't find the page you are looking for.")}
        </Text>
        <Group justify="center">
          <Button component={Link} to={"/home"} variant="subtle" size="md">
            {t("Take me back to homepage")}
          </Button>
        </Group>
      </Container>
    </>
  );
}
