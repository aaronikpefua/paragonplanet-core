const QUALIFICATION_POINTS = [
  "Knowledge and understanding",
  "Reasoning and analytical ability",
  "Capacity to create quality questions",
  "Ability to provide accurate, technical, and meaningful answers to other Backer Contestants",
  "Leadership, communication, and guidance abilities within their respective fields",
];

export default function BackerAboutContent({ footer = null, showTitle = true }) {
  return (
    <div>
      {showTitle && <h2 style={titleStyle}>Paragon Planet Backers</h2>}
      <p>
        Contestants for Paragon Planet Backers are selected from individuals, professionals, and
        service providers operating within sectors such as Health, Environment, Education,
        Enterprise, Entertainment, Finance, Security, Media, Law, Technology, Governance, and
        Religion.
      </p>
      <p>
        These contestants compete to earn scores, rewards, and qualification marks through
        Questions & Answers, reasoning activities, analytical challenges, engagement tasks, and
        knowledge-based participation across the twelve service fields in order to become Official
        Backers of Paragon Planet.
      </p>

      <h3>The Qualification Process Is Based On:</h3>
      <ul>
        {QUALIFICATION_POINTS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p>
        Contestants who actively participate in a single verified field may qualify for Level 1
        Status and receive a unique Planet Identity Color. Participants may progress from Single
        Field (Level 1) to Double Fields (Level 2), Triple Fields (Level 3), and ultimately to
        Multiple Fields at higher Planet Levels based on their consistency, performance,
        engagement, and qualification scores.
      </p>
      <p>
        Qualified contestants earn the opportunity to participate in the Game of ALL STARS GBAZILO
        as the External Feeders to the Planet, operating within their respective zones outside the
        Planet to guide, support, influence, and indirectly communicate with their respective
        Citizens inside the Camp.
      </p>
      <p>
        As External Feeders to the Planet, Official Backers help strengthen the activities,
        development, performance, visibility, and strategic growth of Contestants and Citizens
        participating in ALL STARS GBAZILO, while also earning rewards, recognition, and benefits
        through the platform's engagement structure.
      </p>
      <p>
        The first three contestants who successfully participate across all twelve verified service
        fields and achieve the highest qualification marks shall automatically qualify as the Royal
        Backers to the Kings or Queens at the commencement of the Game.
      </p>
      {footer}
    </div>
  );
}

const titleStyle = {
  marginTop: 0,
};
