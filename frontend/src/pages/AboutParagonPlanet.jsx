import { useNavigate } from "react-router-dom";
import SuperbossAboutContent from "../components/SuperbossAboutContent";
import CitizenAboutContent from "../components/CitizenAboutContent";
import BackerAboutContent from "../components/BackerAboutContent";
import AmbassadorAboutContent from "../components/AmbassadorAboutContent";

const fruitPoints = [
  "One hundred and twenty edible Fruits",
  "One hundred and twenty inedible Fruits",
];

export default function AboutParagonPlanet() {
  const navigate = useNavigate();

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <button type="button" onClick={() => navigate(-1)} style={backButtonStyle}>
          Go Back
        </button>
        <p style={eyebrowStyle}>About Paragon Planet app</p>
        <h1 style={titleStyle}>A gateway for Stars, creativity, and reasoning.</h1>
        <p style={leadStyle}>
          The Paragon Planet app serves as a gateway for talented individuals to showcase their
          skills, participate in creative competitions, engage with audiences, and earn rewards
          through voting, trading, and digital products.
        </p>
        <p style={bodyTextStyle}>
          The platform is designed to discover, promote, and develop emerging stars, helping them
          build the required qualities, visibility, performance strength, and number of Stars needed
          for the coming of Paragon Planet as it prepares to visit Planet Earth.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>ALL STARS GBAZILO</h2>
        <p style={bodyTextStyle}>
          Paragon Planet is a distinctive realm within the entertainment industry, designed as a
          creative environment for selected talents, creators, and entertainers to engage in the
          game known as ALL STARS GBAZILO, meaning ALL STARS COMPETE FOR REASONING.
        </p>
        <p style={bodyTextStyle}>
          The concept emphasizes creativity, reasoning, performance, interaction, talent
          development, and entertainment excellence.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>The Three Systems</h2>
        <p style={bodyTextStyle}>
          The platform is structured into three systems: the Citizens, the Backers, and the
          Superbosses with their respective ambassadors.
        </p>
        <div style={roleGridStyle}>
          <InfoCard title="The Ambassadors">
            <AmbassadorAboutContent />
          </InfoCard>
          <InfoCard title="The Three Feeders">
            The Citizens are the Internal Feeders who shall live together within a unique Camp under
            the Game. The Backers are the External Feeders who shall be assigned to guide, support,
            and direct their respective Citizens inside the Camp while operating from their
            designated zones outside the Camp. The Superbosses are the Positional Feeders who shall
            operate through positions of authority to oversee, supervise, and coordinate the
            relationship between the Backers and the Citizens from their respective zones outside
            the Camp.
          </InfoCard>
        </div>
        <p style={bodyTextStyle}>
          Each of the three systems is organized into twelve categories of participants, with each
          category representing different talents, skills, professions, and creative abilities.
          Participants can progress from Single-Talent Holders as Level One Participants to
          Twelve-Talent Holders, the highest level within the ecosystem, based on their performance,
          audience engagement, creativity, consistency, discipline, and overall impact within the
          Paragon Planet ecosystem.
        </p>
        <p style={bodyTextStyle}>
          The top three participants shall automatically be designated as the Royal Figures of the
          three sectors of the Game: the Paragon Planet Citizens Sector, the Paragon Planet Backers
          Sector, and the Paragon Planet Superbosses Sector.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>The Camp</h2>
        <p style={bodyTextStyle}>
          The Camp features three Kingdoms corresponding to three Tribes, a religion known as
          Ethical Talents Show (ETS), various cultures, a governing structure, social activities,
          and abundant mineral resources across different areas of the Planet, all supported by a
          unique currency.
        </p>
      </section>

      <section style={splitSectionStyle}>
        <InfoCard title="Paragon Citizens">
          <CitizenAboutContent showTitle={false} />
        </InfoCard>

        <InfoCard title="Paragon Planet Backers">
          <BackerAboutContent showTitle={false} />
        </InfoCard>

        <InfoCard title="Paragon Planet Superbosses">
          <SuperbossAboutContent showTitle={false} />
        </InfoCard>
      </section>

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>The ALL STARS GBAZILO GAME</h2>
        <p style={bodyTextStyle}>
          The ALL STARS GBAZILO GAME operates through a symbolic system of two hundred and forty
          Fruits, consisting of:
        </p>
        <List items={fruitPoints} />
        <p style={bodyTextStyle}>
          These Fruits represent behavioural traits, ethical choices, attitudes, actions, and
          consequences within Paragon Planet. The entire system is governed through the mathematical
          relationship structure:
        </p>
        <div style={formulaStyle}>(SPECIFIC FORMULA)</div>
        <p style={bodyTextStyle}>Within this structure:</p>
        <List
          items={[
            "Virtue Superbosses supervise positive activities, ethical conduct, discipline, growth, wisdom, and constructive influence through the one hundred and twenty edible Fruits.",
            "Vice Superbosses supervise negative activities, unethical conduct, temptation, conflict, disorder, and destructive influence through the one hundred and twenty inedible Fruits.",
          ]}
        />
        <p style={bodyTextStyle}>
          Together, both sets of Fruits form one hundred and twenty opposing pairs, arranged
          sequentially across the one hundred and twenty-day visits of Paragon Planet on Planet
          Earth. Each opposing pair represents a specific topic, challenge, behaviour, or moral
          decision assigned to a particular day of the Game.
        </p>
        <p style={bodyTextStyle}>
          Whenever a Citizen performs an action within the Planet, that action is symbolically
          connected to one of the Fruits under the authority of the corresponding Superboss for that
          day.
        </p>
        <List
          items={[
            "Ethical actions are regarded as symbolic acts of consuming the edible Fruits under the Virtue Superbosses. These actions positively increase the Citizen's life span, status, rewards, influence, and standing within the Planet.",
            "Unethical actions are regarded as symbolic acts of consuming the inedible Fruits under the Vice Superbosses. These actions negatively reduce the Citizen's life span, privileges, rankings, rewards, and overall standing within the Planet.",
          ]}
        />
        <p style={bodyTextStyle}>
          Through this symbolic structure, the ALL STARS GBAZILO GAME is designed to promote
          discipline, accountability, wisdom, competition, self-control, leadership, and moral
          decision-making among all participants within the Paragon Planet ecosystem.
        </p>
      </section>
    </main>
  );
}

function InfoCard({ title, children }) {
  return (
    <article style={cardStyle}>
      <h3 style={cardTitleStyle}>{title}</h3>
      <div style={bodyTextStyle}>{children}</div>
    </article>
  );
}

function List({ items }) {
  return (
    <ul style={listStyle}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

const pageStyle = {
  minHeight: "100vh",
  padding: "104px 24px 54px",
  background:
    "radial-gradient(circle at top left, rgba(255, 205, 86, 0.16), transparent 28%), radial-gradient(circle at 90% 20%, rgba(46, 204, 113, 0.14), transparent 24%), #f7f3ea",
  color: "#102033",
};

const heroStyle = {
  maxWidth: 1120,
  margin: "0 auto 24px",
  padding: 28,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 14,
  boxShadow: "0 18px 44px rgba(31, 41, 51, 0.08)",
};

const sectionStyle = {
  maxWidth: 1120,
  margin: "0 auto 24px",
  padding: 24,
  background: "#fffdf8",
  border: "1px solid #e2d8c8",
  borderRadius: 14,
};

const splitSectionStyle = {
  maxWidth: 1120,
  margin: "0 auto 24px",
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};

const backButtonStyle = {
  border: "none",
  borderRadius: 8,
  padding: "10px 14px",
  background: "#1f2933",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  marginBottom: 18,
};

const eyebrowStyle = {
  margin: 0,
  color: "#6b5f4b",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const titleStyle = {
  margin: "8px 0 12px",
  fontSize: "clamp(34px, 6vw, 58px)",
  lineHeight: 1.04,
};

const leadStyle = {
  maxWidth: 900,
  fontSize: 20,
  lineHeight: 1.6,
  color: "#26384d",
};

const bodyTextStyle = {
  fontSize: 16,
  lineHeight: 1.7,
  color: "inherit",
};

const sectionTitleStyle = {
  margin: "0 0 12px",
  fontSize: "clamp(26px, 4vw, 36px)",
  lineHeight: 1.1,
};

const roleGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  margin: "18px 0",
};

const cardStyle = {
  padding: 20,
  background: "#fff",
  border: "1px solid #e2d8c8",
  borderRadius: 12,
  boxShadow: "0 8px 22px rgba(31, 41, 51, 0.05)",
};

const cardTitleStyle = {
  margin: "0 0 8px",
  fontSize: 24,
};

const listStyle = {
  margin: "14px 0 0",
  paddingLeft: 22,
  lineHeight: 1.8,
};

const formulaStyle = {
  margin: "18px 0",
  padding: 16,
  borderRadius: 12,
  background: "#101828",
  color: "#fff",
  fontWeight: 900,
  textAlign: "center",
  letterSpacing: 0,
};
