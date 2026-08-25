import { Title, Text, Button, Container, Group } from "@mantine/core";
import classes from "./error-404.module.css";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { getAppName } from "@/lib/config.ts";

export function Error404() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        {/* Helmet 의 title 은 자식이 하나여야 적용된다 —
            `{expr} - Manadocs` 처럼 쪼개 두면 무시되고 index.html 기본값이 남는다 */}
        <title>{`${t("404 page not found")} - ${getAppName()}`}</title>
      </Helmet>
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
