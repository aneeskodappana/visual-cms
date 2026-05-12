export const projectionBlendVertex = () =>
  `
    uniform vec3 imageOnePosition;
    uniform float imageOneUvRotation;

    uniform vec3 imageTwoPosition;
    uniform float imageTwoUvRotation;

    varying vec3 imageOneDirection;
    varying vec3 imageTwoDirection;

    const float pi = 3.141592653589793238462643383279502884197169;

    void main()
    {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

        vec4 worldVertexPosition = modelMatrix * vec4(position,1.0);

        float sOne = sin (-(imageOneUvRotation / 180.0) * pi);
        float cOne = cos ((imageOneUvRotation / 180.0) * pi);
        mat2 rotationMatrixOne = mat2( cOne,-sOne,sOne,cOne);
        rotationMatrixOne *= 0.5;
        rotationMatrixOne += 0.5;
        rotationMatrixOne = rotationMatrixOne * 2.0-1.0;

        vec4 worldPositionOne = worldVertexPosition - vec4(imageOnePosition,1.0);
        imageOneDirection =  worldPositionOne.xyz;
        imageOneDirection.xz = worldPositionOne.xz * rotationMatrixOne;

        float sTwo = sin (-(imageTwoUvRotation / 180.0) * pi);
        float cTwo = cos ((imageTwoUvRotation / 180.0) * pi);
        mat2 rotationMatrixTwo = mat2( cTwo,-sTwo,sTwo,cTwo);
        rotationMatrixTwo *= 0.5;
        rotationMatrixTwo += 0.5;
        rotationMatrixTwo = rotationMatrixTwo * 2.0-1.0;

        vec4 worldPositionTwo = worldVertexPosition - vec4(imageTwoPosition,1.0);
        imageTwoDirection =  worldPositionTwo.xyz;
        imageTwoDirection.xz = worldPositionTwo.xz * rotationMatrixTwo;
    }
  `;

export const projectionBlendFrag = () =>
  `
    uniform float blendAmount;
    uniform sampler2D imageOneTexture;
    uniform sampler2D imageTwoTexture;
    uniform bool useFadeToBlack;

    const float pi = 3.141592653589793238462643383279502884197169;

    varying vec3 imageOneDirection;
    varying vec3 imageTwoDirection;

    void main()
    {
        vec3 direction = normalize(imageOneDirection);
        vec2 longlat = vec2(atan(direction.z, direction.x), acos(-direction.y));
        vec2 uv = longlat / vec2(2.0 * pi, pi);
        uv.x +=0.5;
        vec4 texOneColor = texture2D(imageOneTexture, uv);

        direction = normalize(imageTwoDirection);
        longlat = vec2(atan(direction.z, direction.x), acos(-direction.y));
        uv = longlat / vec2(2.0 * pi, pi);
        uv.x +=0.5;
        vec4 texTwoColor = texture2D(imageTwoTexture, uv);

        vec4 finalColor;

        if (useFadeToBlack) {
            vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
            float fadeOutEnd = 0.3;
            float fadeInStart = 0.7;

            if (blendAmount < fadeOutEnd) {
                float t = blendAmount / fadeOutEnd;
                finalColor = mix(texOneColor, black, t);
            } else if (blendAmount < fadeInStart) {
                finalColor = black;
            } else {
                float t = (blendAmount - fadeInStart) / (1.0 - fadeInStart);
                finalColor = mix(black, texTwoColor, t);
            }
        } else {
            finalColor = mix(texOneColor, texTwoColor, blendAmount);
        }

        gl_FragColor = finalColor;
    }
  `;
