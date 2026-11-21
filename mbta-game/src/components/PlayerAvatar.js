import { useEffect, useState } from 'react';

import { AvatarPaths } from './AvatarSprite';

const SPRITE_PX = 3;
export const PLAYER_HEIGHT = 16 * SPRITE_PX;

/** The rider's avatar standing over the current stop, bobbing on a two-frame loop. */
export default function PlayerAvatar({ avatar, x, y }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 380);
    return () => clearInterval(id);
  }, []);

  return <AvatarPaths avatar={avatar} x={x} y={y} px={SPRITE_PX} transform={`translate(0 ${frame * -SPRITE_PX})`} />;
}
