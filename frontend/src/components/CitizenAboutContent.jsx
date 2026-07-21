const CITIZEN_EXPECTATIONS = [
  "Upload and showcase their talents and creative abilities",
  "Build followers, visibility, and audience engagement through their respective Ambassadors",
  "Receive votes, rewards, and fan support from viewers and supporters",
  "Rise through different contest levels based on performance, creativity, consistency, and participation",
  "Develop their influence, recognition, and standing within the ecosystem",
  "Participate in contests, challenges, and promotional activities",
  "Work toward qualifying to enter the Planet as Official Citizens of Paragon Planet",
];

const CITIZEN_FRUITS = [
  "One Hundred and Twenty Edible Fruits supervised under the Virtue Superbosses",
  "One Hundred and Twenty Inedible Fruits supervised under the Vice Superbosses",
];

export default function CitizenAboutContent({ theme = "light", showTitle = true }) {
  const dark = theme === "dark";
  const textStyle = dark ? darkTextStyle : lightTextStyle;
  const listStyle = dark ? darkListStyle : lightListStyle;

  return (
    <div>
      {showTitle && <h2 style={titleStyle}>Paragon Citizens</h2>}
      <p style={textStyle}>
        Contestants for Paragon Citizens are talented individuals with one or multiple
        entertainment talents and creative abilities competing across various categories, including
        Cultural Performance, Special Talent, Dance, Instrumental Performance, Modeling, Culinary
        Arts, Stunt Performance, Singing, Debating, Comedy, Art & Design, and Drama.
      </p>

      <h3 style={subtitleStyle}>Contestants Are Expected To:</h3>
      <ul style={listStyle}>
        {CITIZEN_EXPECTATIONS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p style={textStyle}>
        Contestants who actively perform within a single verified talent category may qualify for
        Level One Status and receive a unique Planet Identity Colour. Participants may progress
        from Single Talent (Level 1) to Double Talents (Level 2), Triple Talents (Level 3), and
        ultimately to Multiple Talents across higher Planet Levels.
      </p>
      <p style={textStyle}>
        Qualified contestants earn the opportunity to participate in the ALL STARS GBAZILO GAME as
        the Official Citizens of the Planet.
      </p>
      <p style={textStyle}>
        The first three contestants who successfully perform across all twelve verified talent
        categories and receive the highest verified votes shall automatically qualify for the Royal
        Positions of Kings or Queens upon officially entering the Planet.
      </p>
      <p style={textStyle}>
        These Citizens are known as the Internal Feeders of the Planet and operate under the
        symbolic system of Two Hundred and Forty Fruits consisting of:
      </p>
      <ul style={listStyle}>
        {CITIZEN_FRUITS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p style={textStyle}>
        Within the Game, the actions, behaviors, attitudes, performances, decisions, and activities
        of Citizens are symbolically connected to these Fruits, which influence their rankings,
        rewards, privileges, reputation, life span, discipline level, and overall standing within
        the Paragon Planet ecosystem.
      </p>
    </div>
  );
}

const titleStyle = {
  marginTop: 0,
};

const subtitleStyle = {
  marginBottom: 8,
};

const lightTextStyle = {
  lineHeight: 1.65,
  color: "#26384d",
};

const darkTextStyle = {
  lineHeight: 1.65,
  color: "#d9d4ca",
};

const lightListStyle = {
  lineHeight: 1.7,
  color: "#26384d",
  paddingLeft: 22,
};

const darkListStyle = {
  lineHeight: 1.65,
  color: "#f3efe6",
  paddingLeft: 20,
};
